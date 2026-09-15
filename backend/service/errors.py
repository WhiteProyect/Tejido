class AppError(Exception):
    """Error de aplicación con el mismo shape que backend/app.py::Handler.error()
    ({"error": code, "message": message}) para no romper al frontend actual.
    """

    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)
