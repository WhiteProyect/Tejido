"""
Proteccion contra fuerza bruta en /api/auth/login.

Usa el motor de rate limiting de `limits` (la libreria de la que depende
`slowapi`) directamente en vez del decorador @limiter.limit(): ese decorador
cuenta TODAS las llamadas al endpoint antes de saber si el login fue exitoso,
y aca se necesita contar solo los intentos FALLIDOS (un login correcto no
debe sumar al contador). Con test()/hit() manuales se logra ese control.

Bloqueo: 5 intentos fallidos por email y, por separado, 5 por IP, dentro de
una ventana fija de 5 minutos. Al superarlo, la ventana sigue contando hasta
que expira (bloqueo de hasta unos minutos), sin necesitar un temporizador de
lockout aparte.
"""
from limits import RateLimitItemPerHour, RateLimitItemPerMinute
from limits.storage import MemoryStorage
from limits.strategies import FixedWindowRateLimiter

LOGIN_FAIL_LIMIT = RateLimitItemPerMinute(5, 5)

_storage = MemoryStorage()
_limiter = FixedWindowRateLimiter(_storage)


def _email_key(email: str) -> str:
    return f"login-fail:email:{email}"


def _ip_key(ip: str) -> str:
    return f"login-fail:ip:{ip}"


def is_login_locked(ip: str, email: str) -> bool:
    """True si otro intento (con esta IP o este email) ya superaria el limite."""
    if not _limiter.test(LOGIN_FAIL_LIMIT, _email_key(email)):
        return True
    if not _limiter.test(LOGIN_FAIL_LIMIT, _ip_key(ip)):
        return True
    return False


def register_login_failure(ip: str, email: str) -> None:
    _limiter.hit(LOGIN_FAIL_LIMIT, _email_key(email))
    _limiter.hit(LOGIN_FAIL_LIMIT, _ip_key(ip))


def reset_login_rate_limit() -> None:
    """Solo para tests: limpia todo el estado en memoria del limiter."""
    _storage.reset()


# ---------------------------------------------------------------------------
# Registro publico (/api/auth/signup): mismo motor y misma ventana, pero aca
# cuenta TODOS los intentos por IP (exitosos incluidos), porque lo que se
# frena es crear cuentas en masa, no adivinar contrasenas.
# ---------------------------------------------------------------------------

SIGNUP_LIMIT = RateLimitItemPerMinute(5, 5)


def _signup_key(ip: str) -> str:
    return f"signup:ip:{ip}"


def is_signup_locked(ip: str) -> bool:
    return not _limiter.test(SIGNUP_LIMIT, _signup_key(ip))


def register_signup_attempt(ip: str) -> None:
    _limiter.hit(SIGNUP_LIMIT, _signup_key(ip))


# ---------------------------------------------------------------------------
# Firmas de subida (/api/uploads/sign): por usuario autenticado, todas cuentan.
# Frena que una sesion pida firmas en bucle (cada firma permite subir a Cloudinary).
# ---------------------------------------------------------------------------

UPLOAD_SIGN_LIMIT = RateLimitItemPerMinute(30)


def allow_upload_signature(user_id: int) -> bool:
    """Cuenta el intento y dice si todavia esta dentro del limite."""
    return _limiter.hit(UPLOAD_SIGN_LIMIT, f"upload-sign:user:{user_id}")


# ---------------------------------------------------------------------------
# Formulario publico de Nosotros (/api/suggestions): por IP, todos los intentos cuentan.
# Frena el spam y protege la cuota de Resend (cada mensaje dispara un aviso al equipo).
# ---------------------------------------------------------------------------

SUGGESTION_LIMIT = RateLimitItemPerMinute(3, 10)


def allow_suggestion(ip: str) -> bool:
    """Cuenta el intento y dice si todavia esta dentro del limite."""
    return _limiter.hit(SUGGESTION_LIMIT, f"suggestion:ip:{ip}")


# ---------------------------------------------------------------------------
# Solicitudes para participar en una rama (/api/branch-requests): por usuario, todas cuentan.
# Cada solicitud avisa por correo al lider o al equipo.
# ---------------------------------------------------------------------------

BRANCH_REQUEST_LIMIT = RateLimitItemPerHour(5)


def allow_branch_request(user_id: int) -> bool:
    """Cuenta el intento y dice si todavia esta dentro del limite."""
    return _limiter.hit(BRANCH_REQUEST_LIMIT, f"branch-request:user:{user_id}")


# ---------------------------------------------------------------------------
# Reenviar el correo de verificacion (/api/auth/resend-verification): por usuario, 1 cada 60 s
# y 5 por hora. Cada pedido manda un correo (cuota de Resend).
# ---------------------------------------------------------------------------

RESEND_VERIFY_SHORT = RateLimitItemPerMinute(1)
RESEND_VERIFY_HOUR = RateLimitItemPerHour(5)


def allow_verification_resend(user_id: int) -> str | None:
    """None si se puede enviar (y lo cuenta); si no, 'minute' u 'hour' segun el limite alcanzado."""
    key = f"verify-resend:user:{user_id}"
    if not _limiter.test(RESEND_VERIFY_SHORT, key):
        return "minute"
    if not _limiter.test(RESEND_VERIFY_HOUR, key):
        return "hour"
    _limiter.hit(RESEND_VERIFY_SHORT, key)
    _limiter.hit(RESEND_VERIFY_HOUR, key)
    return None


# ---------------------------------------------------------------------------
# "Olvide mi contrasena" (/api/auth/forgot-password): por IP (10 cada 15 min) y por correo
# (3 por hora). Se cuenta exista o no la cuenta, para no revelar cuales existen.
# ---------------------------------------------------------------------------

FORGOT_IP_LIMIT = RateLimitItemPerMinute(10, 15)
FORGOT_EMAIL_LIMIT = RateLimitItemPerHour(3)


def allow_password_reset(ip: str, email: str) -> bool:
    ip_key, email_key = f"forgot:ip:{ip}", f"forgot:email:{email}"
    if not _limiter.test(FORGOT_IP_LIMIT, ip_key) or not _limiter.test(FORGOT_EMAIL_LIMIT, email_key):
        return False
    _limiter.hit(FORGOT_IP_LIMIT, ip_key)
    _limiter.hit(FORGOT_EMAIL_LIMIT, email_key)
    return True
