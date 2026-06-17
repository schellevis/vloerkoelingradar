# scripts/places.py
"""Vaste lijst NL forecast-punten voor de Vloerkoelingradar."""

PLACES = [
    # Groningen (GR) - 8 plaatsen
    {"name": "Groningen",       "prov": "GR", "lat": 53.219, "lon": 6.567},
    {"name": "Delfzijl",        "prov": "GR", "lat": 53.337, "lon": 6.926},
    {"name": "Winschoten",      "prov": "GR", "lat": 53.143, "lon": 7.035},
    {"name": "Veendam",         "prov": "GR", "lat": 53.108, "lon": 6.876},
    {"name": "Hoogezand",       "prov": "GR", "lat": 53.162, "lon": 6.771},
    {"name": "Stadskanaal",     "prov": "GR", "lat": 52.983, "lon": 6.951},
    {"name": "Appingedam",      "prov": "GR", "lat": 53.321, "lon": 6.861},
    {"name": "Zuidhorn",        "prov": "GR", "lat": 53.249, "lon": 6.401},

    # Friesland (FR) - 8 plaatsen
    {"name": "Leeuwarden",      "prov": "FR", "lat": 53.201, "lon": 5.808},
    {"name": "Drachten",        "prov": "FR", "lat": 53.112, "lon": 6.099},
    {"name": "Sneek",           "prov": "FR", "lat": 53.032, "lon": 5.660},
    {"name": "Harlingen",       "prov": "FR", "lat": 53.175, "lon": 5.424},
    {"name": "Heerenveen",      "prov": "FR", "lat": 52.960, "lon": 5.921},
    {"name": "Franeker",        "prov": "FR", "lat": 53.188, "lon": 5.545},
    {"name": "Dokkum",          "prov": "FR", "lat": 53.325, "lon": 5.993},
    {"name": "Bolsward",        "prov": "FR", "lat": 53.065, "lon": 5.527},

    # Drenthe (DR) - 7 plaatsen
    {"name": "Assen",           "prov": "DR", "lat": 52.995, "lon": 6.564},
    {"name": "Emmen",           "prov": "DR", "lat": 52.785, "lon": 6.897},
    {"name": "Hoogeveen",       "prov": "DR", "lat": 52.728, "lon": 6.479},
    {"name": "Meppel",          "prov": "DR", "lat": 52.697, "lon": 6.194},
    {"name": "Coevorden",       "prov": "DR", "lat": 52.661, "lon": 6.742},
    {"name": "Roden",           "prov": "DR", "lat": 53.140, "lon": 6.428},
    {"name": "Beilen",          "prov": "DR", "lat": 52.858, "lon": 6.515},

    # Overijssel (OV) - 8 plaatsen
    {"name": "Zwolle",          "prov": "OV", "lat": 52.512, "lon": 6.094},
    {"name": "Enschede",        "prov": "OV", "lat": 52.221, "lon": 6.894},
    {"name": "Hengelo",         "prov": "OV", "lat": 52.264, "lon": 6.794},
    {"name": "Almelo",          "prov": "OV", "lat": 52.356, "lon": 6.665},
    {"name": "Deventer",        "prov": "OV", "lat": 52.255, "lon": 6.163},
    {"name": "Kampen",          "prov": "OV", "lat": 52.550, "lon": 5.911},
    {"name": "Oldenzaal",       "prov": "OV", "lat": 52.311, "lon": 6.929},
    {"name": "Steenwijk",       "prov": "OV", "lat": 52.788, "lon": 6.118},

    # Flevoland (FL) - 6 plaatsen
    {"name": "Lelystad",        "prov": "FL", "lat": 52.518, "lon": 5.471},
    {"name": "Almere",          "prov": "FL", "lat": 52.350, "lon": 5.265},
    {"name": "Emmeloord",       "prov": "FL", "lat": 52.712, "lon": 5.748},
    {"name": "Dronten",         "prov": "FL", "lat": 52.527, "lon": 5.718},
    {"name": "Zeewolde",        "prov": "FL", "lat": 52.333, "lon": 5.540},
    {"name": "Urk",             "prov": "FL", "lat": 52.664, "lon": 5.600},

    # Gelderland (GE) - 8 plaatsen
    {"name": "Arnhem",          "prov": "GE", "lat": 51.985, "lon": 5.899},
    {"name": "Nijmegen",        "prov": "GE", "lat": 51.842, "lon": 5.853},
    {"name": "Apeldoorn",       "prov": "GE", "lat": 52.212, "lon": 5.969},
    {"name": "Ede",             "prov": "GE", "lat": 52.046, "lon": 5.658},
    {"name": "Doetinchem",      "prov": "GE", "lat": 51.963, "lon": 6.297},
    {"name": "Harderwijk",      "prov": "GE", "lat": 52.343, "lon": 5.622},
    {"name": "Zutphen",         "prov": "GE", "lat": 52.139, "lon": 6.198},
    {"name": "Winterswijk",     "prov": "GE", "lat": 51.975, "lon": 6.720},

    # Utrecht (UT) - 7 plaatsen
    {"name": "Utrecht",         "prov": "UT", "lat": 52.091, "lon": 5.122},
    {"name": "Amersfoort",      "prov": "UT", "lat": 52.156, "lon": 5.388},
    {"name": "Veenendaal",      "prov": "UT", "lat": 52.027, "lon": 5.556},
    {"name": "Woerden",         "prov": "UT", "lat": 52.088, "lon": 4.882},
    {"name": "Zeist",           "prov": "UT", "lat": 52.089, "lon": 5.234},
    {"name": "Nieuwegein",      "prov": "UT", "lat": 52.031, "lon": 5.088},
    {"name": "IJsselstein",     "prov": "UT", "lat": 52.022, "lon": 5.029},

    # Noord-Holland (NH) - 8 plaatsen
    {"name": "Amsterdam",       "prov": "NH", "lat": 52.374, "lon": 4.890},
    {"name": "Haarlem",         "prov": "NH", "lat": 52.381, "lon": 4.637},
    {"name": "Alkmaar",         "prov": "NH", "lat": 52.631, "lon": 4.748},
    {"name": "Den Helder",      "prov": "NH", "lat": 52.957, "lon": 4.761},
    {"name": "Zaandam",         "prov": "NH", "lat": 52.437, "lon": 4.831},
    {"name": "Hoorn",           "prov": "NH", "lat": 52.640, "lon": 5.057},
    {"name": "Hilversum",       "prov": "NH", "lat": 52.223, "lon": 5.179},
    {"name": "Purmerend",       "prov": "NH", "lat": 52.502, "lon": 4.955},

    # Zuid-Holland (ZH) - 8 plaatsen
    {"name": "Den Haag",        "prov": "ZH", "lat": 52.078, "lon": 4.288},
    {"name": "Rotterdam",       "prov": "ZH", "lat": 51.922, "lon": 4.479},
    {"name": "Gouda",           "prov": "ZH", "lat": 52.012, "lon": 4.704},
    {"name": "Delft",           "prov": "ZH", "lat": 52.011, "lon": 4.357},
    {"name": "Leiden",          "prov": "ZH", "lat": 52.160, "lon": 4.493},
    {"name": "Dordrecht",       "prov": "ZH", "lat": 51.812, "lon": 4.669},
    {"name": "Zoetermeer",      "prov": "ZH", "lat": 52.056, "lon": 4.493},
    {"name": "Alphen aan den Rijn", "prov": "ZH", "lat": 52.130, "lon": 4.658},

    # Zeeland (ZE) - 7 plaatsen
    {"name": "Middelburg",      "prov": "ZE", "lat": 51.499, "lon": 3.611},
    {"name": "Vlissingen",      "prov": "ZE", "lat": 51.443, "lon": 3.573},
    {"name": "Goes",            "prov": "ZE", "lat": 51.505, "lon": 3.895},
    {"name": "Terneuzen",       "prov": "ZE", "lat": 51.337, "lon": 3.829},
    {"name": "Zierikzee",       "prov": "ZE", "lat": 51.649, "lon": 3.916},
    {"name": "Hulst",           "prov": "ZE", "lat": 51.278, "lon": 4.046},
    {"name": "Sluis",           "prov": "ZE", "lat": 51.302, "lon": 3.386},

    # Noord-Brabant (NB) - 8 plaatsen
    {"name": "Eindhoven",       "prov": "NB", "lat": 51.441, "lon": 5.469},
    {"name": "Tilburg",         "prov": "NB", "lat": 51.560, "lon": 5.091},
    {"name": "Den Bosch",       "prov": "NB", "lat": 51.697, "lon": 5.304},
    {"name": "Breda",           "prov": "NB", "lat": 51.590, "lon": 4.776},
    {"name": "Helmond",         "prov": "NB", "lat": 51.482, "lon": 5.661},
    {"name": "Oss",             "prov": "NB", "lat": 51.765, "lon": 5.521},
    {"name": "Roosendaal",      "prov": "NB", "lat": 51.530, "lon": 4.461},
    {"name": "Waalwijk",        "prov": "NB", "lat": 51.683, "lon": 5.070},
    {"name": "Bergen op Zoom",  "prov": "NB", "lat": 51.493, "lon": 4.290},

    # Limburg (LI) - 7 plaatsen
    {"name": "Maastricht",      "prov": "LI", "lat": 50.851, "lon": 5.691},
    {"name": "Venlo",           "prov": "LI", "lat": 51.370, "lon": 6.172},
    {"name": "Roermond",        "prov": "LI", "lat": 51.194, "lon": 5.983},
    {"name": "Heerlen",         "prov": "LI", "lat": 50.888, "lon": 5.978},
    {"name": "Sittard",         "prov": "LI", "lat": 50.998, "lon": 5.869},
    {"name": "Weert",           "prov": "LI", "lat": 51.249, "lon": 5.707},
    {"name": "Venray",          "prov": "LI", "lat": 51.527, "lon": 5.976},
]
