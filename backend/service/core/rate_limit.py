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
from limits import RateLimitItemPerMinute
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
