ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inativado_em timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inativado_por uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inativado_motivo text;

-- Usuário inativo perde papel, permissões e acesso a unidades imediatamente
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND p.ativo = false)
$$;
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_user_id, 'master') OR (
    NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND p.ativo = false)
    AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role = ur.role
                WHERE ur.user_id = _user_id AND rp.permission = _permission))
$$;
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_unidade(_unidade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _unidade_id IS NULL
      OR public.has_role(auth.uid(), 'master')
      OR (NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.ativo = false)
          AND EXISTS (SELECT 1 FROM public.usuario_unidades uu
                      WHERE uu.usuario_id = auth.uid() AND uu.unidade_id = _unidade_id AND uu.ativo));
$$;

-- O próprio usuário não altera loja, unidade nem situação
CREATE OR REPLACE FUNCTION public.fn__profiles_proteger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'master')
     AND (NEW.loja IS DISTINCT FROM OLD.loja OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id
          OR NEW.ativo IS DISTINCT FROM OLD.ativo OR NEW.inativado_em IS DISTINCT FROM OLD.inativado_em
          OR NEW.inativado_por IS DISTINCT FROM OLD.inativado_por OR NEW.inativado_motivo IS DISTINCT FROM OLD.inativado_motivo
          OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'Somente o Master altera loja ou situação do usuário.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profiles_proteger ON public.profiles;
CREATE TRIGGER trg_profiles_proteger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn__profiles_proteger();

CREATE OR REPLACE FUNCTION public.fn__masters_ativos()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.user_roles ur
  WHERE ur.role = 'master' AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = ur.user_id AND p.ativo = false)
$$;
REVOKE ALL ON FUNCTION public.fn__masters_ativos() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_usuarios_listar()
RETURNS TABLE(user_id uuid, nome text, loja text, unidade_id uuid, role text, ativo boolean, inativado_em timestamptz, inativado_motivo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.nome, p.loja, p.unidade_id,
         (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.user_id
           ORDER BY CASE ur.role WHEN 'master' THEN 0 WHEN 'vendedor_lider' THEN 1 ELSE 2 END LIMIT 1),
         p.ativo, p.inativado_em, p.inativado_motivo
  FROM public.profiles p
  WHERE public.has_role(auth.uid(),'master')
  ORDER BY p.ativo DESC, p.nome
$$;
REVOKE ALL ON FUNCTION public.fn_usuarios_listar() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_usuarios_listar() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_usuario_salvar(p_user_id uuid, p_nome text, p_role public.app_role, p_unidade_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old jsonb; v_un public.unidades; v_role_atual public.app_role;
BEGIN
  IF NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Apenas o Master gerencia usuários.'; END IF;
  IF coalesce(trim(p_nome),'') = '' THEN RAISE EXCEPTION 'Informe o nome.'; END IF;
  PERFORM 1 FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado.'; END IF;
  SELECT role INTO v_role_atual FROM public.user_roles WHERE user_id = p_user_id
    ORDER BY CASE role WHEN 'master' THEN 0 WHEN 'vendedor_lider' THEN 1 ELSE 2 END LIMIT 1;
  IF v_role_atual = 'master' AND p_role <> 'master' THEN
    IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Você não pode tirar seu próprio perfil Master.'; END IF;
    IF public.fn__masters_ativos() <= 1 THEN RAISE EXCEPTION 'É preciso manter pelo menos um Master ativo.'; END IF;
  END IF;
  IF p_role <> 'master' THEN
    SELECT * INTO v_un FROM public.unidades WHERE id = p_unidade_id;
    IF v_un.id IS NULL THEN RAISE EXCEPTION 'Escolha a loja do usuário.'; END IF;
    IF v_un.status = 'INATIVA' THEN RAISE EXCEPTION 'Loja inativa não pode receber usuários.'; END IF;
  END IF;

  SELECT jsonb_build_object('nome',nome,'loja',loja,'unidade_id',unidade_id,'role',v_role_atual) INTO v_old FROM public.profiles WHERE user_id = p_user_id;

  UPDATE public.profiles SET nome = trim(p_nome),
         loja = CASE WHEN p_role = 'master' THEN '' ELSE coalesce(v_un.codigo_legado, v_un.nome_exibicao) END,
         unidade_id = CASE WHEN p_role = 'master' THEN NULL ELSE v_un.id END,
         updated_at = now()
   WHERE user_id = p_user_id;

  UPDATE public.user_roles SET role = p_role WHERE user_id = p_user_id
    AND id = (SELECT id FROM public.user_roles WHERE user_id = p_user_id ORDER BY CASE role WHEN 'master' THEN 0 WHEN 'vendedor_lider' THEN 1 ELSE 2 END LIMIT 1);
  IF NOT FOUND THEN INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_role); END IF;

  IF p_role <> 'master' THEN
    UPDATE public.usuario_unidades SET ativo = false WHERE usuario_id = p_user_id AND unidade_id <> v_un.id AND ativo;
    INSERT INTO public.usuario_unidades (usuario_id, unidade_id, ativo) VALUES (p_user_id, v_un.id, true)
    ON CONFLICT (usuario_id, unidade_id) DO UPDATE SET ativo = true;
  END IF;

  PERFORM public.fn_audit('USUARIO_ALTERADO','usuario',p_user_id, CASE WHEN p_role='master' THEN NULL ELSE v_un.id END, v_old,
    jsonb_build_object('nome',trim(p_nome),'role',p_role,'unidade_id',CASE WHEN p_role='master' THEN NULL ELSE v_un.id END));
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.fn_usuario_salvar(uuid,text,public.app_role,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_usuario_salvar(uuid,text,public.app_role,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_usuario_definir_ativo(p_user_id uuid, p_ativo boolean, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_atual boolean;
BEGIN
  IF NOT public.has_role(auth.uid(),'master') THEN RAISE EXCEPTION 'Apenas o Master gerencia usuários.'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Você não pode inativar a si mesmo.'; END IF;
  SELECT ativo INTO v_atual FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado.'; END IF;
  IF v_atual = p_ativo THEN RETURN jsonb_build_object('ok',true,'sem_mudanca',true); END IF;
  IF NOT p_ativo THEN
    IF length(coalesce(trim(p_motivo),'')) < 5 THEN RAISE EXCEPTION 'Informe o motivo da inativação.'; END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role='master') AND public.fn__masters_ativos() <= 1 THEN
      RAISE EXCEPTION 'É preciso manter pelo menos um Master ativo.';
    END IF;
  END IF;
  UPDATE public.profiles SET ativo = p_ativo,
         inativado_em = CASE WHEN p_ativo THEN NULL ELSE now() END,
         inativado_por = CASE WHEN p_ativo THEN NULL ELSE auth.uid() END,
         inativado_motivo = CASE WHEN p_ativo THEN NULL ELSE trim(p_motivo) END,
         updated_at = now()
   WHERE user_id = p_user_id;
  PERFORM public.fn_audit(CASE WHEN p_ativo THEN 'USUARIO_REATIVADO' ELSE 'USUARIO_INATIVADO' END,'usuario',p_user_id,NULL,
    jsonb_build_object('ativo',v_atual), jsonb_build_object('ativo',p_ativo,'motivo',p_motivo));
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.fn_usuario_definir_ativo(uuid,boolean,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_usuario_definir_ativo(uuid,boolean,text) TO authenticated;