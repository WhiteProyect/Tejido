# Scripts de Arranque - TEJIDO

Esta carpeta contiene los scripts necesarios para iniciar la aplicación TEJIDO en diferentes plataformas y configuraciones.

## 📁 Contenido

### `INICIAR_TEJIDO.ps1` (Recomendado)
**Plataforma:** Windows (PowerShell)  
**Uso:**
```powershell
cd C:\Users\Bryan\Tejido\tejido
.\scripts\INICIAR_TEJIDO.ps1
```

### `INICIAR_TEJIDO.bat`
**Plataforma:** Windows (Cmd, invoca el .ps1)  
**Uso:**
```cmd
cd C:\Users\Bryan\Tejido\tejido
scripts\INICIAR_TEJIDO.bat
```

## 🚀 Ejecución Rápida

**Opción 1:** PowerShell (Recomendado -- levanta backend + frontend y abre el navegador)
```powershell
cd C:\Users\Bryan\Tejido\tejido
./scripts/INICIAR_TEJIDO.ps1
```

**Opción 2:** Solo backend, Python directo
```bash
cd C:\Users\Bryan\Tejido\tejido
python server.py
```

## ✅ Verificación

Prueba la conexión:
```bash
curl http://127.0.0.1:8765/api/health
```

Respuesta esperada:
```json
{"status": "ok", "database": "ok", "time": "2026-09-14T..."}
```

## 🔧 Configuración

Host, puerto y demas variables se leen desde `.env` (ver `.env.example` en la
raiz del proyecto), via `pydantic-settings` en `backend/service/core/config.py`
-- ya no hay un `backend/config.py` con valores hardcodeados.

---

**Última actualización:** 2026-09-14  
**Estado:** ✅ Funcional (FastAPI + PostgreSQL/Neon)
