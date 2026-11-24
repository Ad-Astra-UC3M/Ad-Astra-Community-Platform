-- Primera concesión de administración desde el SQL Editor de Neon.
-- Selecciona la rama/base de datos que usa la aplicación y sustituye el correo.
-- La cuenta debe haberse registrado y verificado desde Comunidad.
-- Registra una auditoría solo cuando concede el permiso por primera vez.
-- Si no devuelve filas, ya tenía el permiso o no existe un perfil elegible.
WITH granted AS (
  INSERT INTO public.account_capabilities
    (profile_id, capability_code, granted_by)
  SELECT id, 'general_admin', NULL
  FROM public.profiles
  WHERE email = lower(btrim('TU_CORREO@uc3m.es'))
    AND status = 'active'
    AND auth_user_id IS NOT NULL
    AND email_verified_at IS NOT NULL
  ON CONFLICT (profile_id, capability_code) DO NOTHING
  RETURNING profile_id
)
INSERT INTO public.admin_audit_logs
  (actor_profile_id, target_type, target_id, action, result, metadata)
SELECT NULL, 'profile', profile_id, 'capability_granted', 'success',
       '{"capability":"general_admin","source":"bootstrap"}'::jsonb
FROM granted
RETURNING target_id AS administrador;

-- general_admin permite gestionar cuentas en /admin/accounts.
-- Contenido, asistencia y consulta de talento tienen capacidades independientes.
