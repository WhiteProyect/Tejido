"""Constantes de los lugares (publicaciones LUGAR) y de sus categorias administrables.

Iconos y colores son conjuntos cerrados (CHECK en la base). Los mismos nombres usa el frontend:
frontend/src/utils/placeIcons.js (trazos SVG de cada icono) y uiStyles.js::PLACE_COLORS.
"""

# Iconos de las categorias de lugar (24x24, trazo fino, como components/Icon.jsx).
PLACE_ICONS = (
    "utensils",   # cubiertos: restaurantes
    "bed",        # cama: hoteles y hospedajes
    "binoculars",  # binoculares: miradores
    "tree",       # arbol: parques y reservas
    "ball",       # balon: canchas y escenarios deportivos
    "store",      # toldo de tienda: puestos y mercados
    "landmark",   # edificio con columnas: sitios culturales y patrimonio
    "pin",        # marcador generico
    "coffee",     # taza: cafes y heladerias
    "waves",      # olas: rios, playas y balnearios
)

# Paleta cerrada (la de los tipos de oportunidad mas rio y bosque).
PLACE_COLORS = ("ocre", "menta", "morado", "amarillo", "crema", "rio", "bosque")

# Las 7 categorias iniciales que siembra la migracion c7e2a4f6b8d1 (slug, etiqueta, icono, color).
INITIAL_PLACE_CATEGORIES = (
    ("restaurantes", "Restaurantes", "utensils", "ocre"),
    ("hoteles", "Hoteles", "bed", "morado"),
    ("miradores", "Miradores", "binoculars", "rio"),
    ("parques", "Parques", "tree", "bosque"),
    ("canchas-libres", "Canchas libres", "ball", "menta"),
    ("puestos-gastronomicos", "Puestos gastronómicos", "store", "amarillo"),
    ("sitios-culturales", "Sitios culturales", "landmark", "crema"),
)
