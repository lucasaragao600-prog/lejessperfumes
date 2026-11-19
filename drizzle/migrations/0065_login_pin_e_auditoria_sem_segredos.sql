CREATE TABLE IF NOT EXISTS public.usuario_pins (
  user_id uuid PRIMARY KEY,
  pin_hash text NOT NULL,
  tentativas int NOT NULL DEFAULT 0,
  bloqueado_ate timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.usuario_pins FROM anon, authenticated;
GRANT ALL ON public.usuario_pins TO service_role;
ALTER TABLE public.usuario_pins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn__sanitizar_segredos(j jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN j IS NULL THEN NULL
    WHEN jsonb_typeof(j) = 'object' THEN COALESCE((
      SELECT jsonb_object_agg(k, CASE WHEN k ~* '(senha|password|passwd|pin|token|csc|secret|segredo|certificado_senha|api_key|apikey)' THEN to_jsonb('[removido]'::text) ELSE public.fn__sanitizar_segredos(v) END)
      FROM jsonb_each(j) AS e(k, v)), '{}'::jsonb)
    WHEN jsonb_typeof(j) = 'array' THEN COALESCE((SELECT jsonb_agg(public.fn__sanitizar_segredos(v)) FROM jsonb_array_elements(j) AS a(v)), '[]'::jsonb)
    ELSE j END
$$;

CREATE OR REPLACE FUNCTION public.fn__audit_sanitizar() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.dados_anteriores := public.fn__sanitizar_segredos(NEW.dados_anteriores);
  NEW.dados_novos := public.fn__sanitizar_segredos(NEW.dados_novos);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_audit_sanitizar ON public.audit_logs;
CREATE TRIGGER trg_audit_sanitizar BEFORE INSERT OR UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn__audit_sanitizar();

CREATE OR REPLACE FUNCTION public.fn_pin_definir(p_pin text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4,6}$' THEN RAISE EXCEPTION 'PIN deve ter de 4 a 6 números'; END IF;
  IF p_pin ~ '^(\d)\1+$' OR p_pin IN ('1234','12345','123456','4321','654321') THEN RAISE EXCEPTION 'PIN muito fácil, escolha outro'; END IF;
  INSERT INTO public.usuario_pins(user_id, pin_hash) VALUES (auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  ON CONFLICT (user_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, tentativas = 0, bloqueado_ate = NULL, atualizado_em = now();
  PERFORM public.fn_audit('pin_definido', 'usuario', auth.uid(), NULL, NULL, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.fn_pin_status() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.usuario_pins WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.fn_pin_remover(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR (p_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'master')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  DELETE FROM public.usuario_pins WHERE user_id = p_user_id;
  PERFORM public.fn_audit('pin_removido', 'usuario', p_user_id, NULL, NULL, NULL);
END $$;

-- Só a função de login (service_role) chama. Retorna user_id ou NULL; controla bloqueio.
CREATE OR REPLACE FUNCTION public.fn_pin_verificar(p_email text, p_pin text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid; r public.usuario_pins%ROWTYPE;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO r FROM public.usuario_pins WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF r.bloqueado_ate IS NOT NULL AND r.bloqueado_ate > now() THEN RAISE EXCEPTION 'PIN_BLOQUEADO'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_uid AND COALESCE(ativo, true)) THEN RETURN NULL; END IF;
  IF r.pin_hash = extensions.crypt(p_pin, r.pin_hash) THEN
    UPDATE public.usuario_pins SET tentativas = 0, bloqueado_ate = NULL WHERE user_id = v_uid;
    RETURN v_uid;
  END IF;
  UPDATE public.usuario_pins SET tentativas = tentativas + 1,
    bloqueado_ate = CASE WHEN tentativas + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
  WHERE user_id = v_uid;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.fn_pin_verificar(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pin_verificar(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.fn_pin_definir(text), public.fn_pin_status(), public.fn_pin_remover(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pin_definir(text), public.fn_pin_status(), public.fn_pin_remover(uuid) TO authenticated;
UPDATE public.audit_logs SET dados_novos = dados_novos WHERE dados_novos::text ~* '(senha|password|"pin|token|csc|secret)' OR dados_anteriores::text ~* '(senha|password|"pin|token|csc|secret)';