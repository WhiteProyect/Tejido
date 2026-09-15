"""
Hashing de contraseñas — portado sin cambios desde backend/services/auth_service.py.

Se mantiene el mismo PBKDF2-HMAC-SHA256 de siempre (y no se reemplaza por
passlib/bcrypt) a propósito: las 3 cuentas demo (admin@tejido.co,
gestor@tejido.co, ciudadano@tejido.co) ya tienen su password_hash guardado con
este esquema, y cambiarlo invalidaría esos logins.
"""
import hashlib
import hmac
import secrets


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000).hex()
    return salt + "$" + digest


def verify_password(password, stored):
    try:
        salt, digest = stored.split("$", 1)
        candidate = hash_password(password, salt).split("$", 1)[1]
        return hmac.compare_digest(candidate, digest)
    except (AttributeError, ValueError):
        return False
