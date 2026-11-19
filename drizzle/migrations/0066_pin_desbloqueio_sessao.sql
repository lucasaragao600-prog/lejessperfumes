CREATE OR REPLACE FUNCTION public.fn_pin_conferir(p_pin text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.usuario_pins%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO r FROM public.usuario_pins WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN 'sem_pin'; END IF;
  IF r.bloqueado_ate IS NOT NULL AND r.bloqueado_ate > now() THEN RETURN 'bloqueado'; END IF;
  IF r.pin_hash = extensions.crypt(COALESCE(p_pin,''), r.pin_hash) THEN
    UPDATE public.usuario_pins SET tentativas = 0, bloqueado_ate = NULL WHERE user_id = auth.uid();
    RETURN 'ok';
  END IF;
  UPDATE public.usuario_pins SET tentativas = tentativas + 1,
    bloqueado_ate = CASE WHEN tentativas + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
  WHERE user_id = auth.uid() RETURNING * INTO r;
  IF r.bloqueado_ate IS NOT NULL THEN
    PERFORM public.fn_audit('pin_bloqueado', 'usuario', auth.uid(), NULL, NULL, NULL);
    RETURN 'bloqueado';
  END IF;
  RETURN 'errado';
END $$;
REVOKE ALL ON FUNCTION public.fn_pin_conferir(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pin_conferir(text) TO authenticated;