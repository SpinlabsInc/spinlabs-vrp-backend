from decimal import Decimal

# Define your locations
locations = [
    (Decimal('17.9787'), Decimal('79.6010')),  # Warangal
    (Decimal('17.9607'), Decimal('79.5946')),  # Warangal Fort
    (Decimal('17.9940'), Decimal('79.5947')),  # Matwada
    (Decimal('17.9567'), Decimal('79.5930')),  # Fort Road
    (Decimal('17.9936'), Decimal('79.5292')),  # Madikonda

    (Decimal('17.9746'), Decimal('79.5937')),  # Hanamkonda
    (Decimal('17.9758'), Decimal('79.5821')),  # Kakaji Nagar
    (Decimal('17.9784'), Decimal('79.5797')),  # Balasamudram
    (Decimal('17.9776'), Decimal('79.5732')),  # Reddy Colony
    (Decimal('17.9613'), Decimal('79.5912')),  # Lashkar Singaram

    (Decimal('17.9852'), Decimal('79.5226')),  # Kazipet Railway Station
    (Decimal('17.9873'), Decimal('79.5239')),  # Kazipet Town
    (Decimal('17.9922'), Decimal('79.5224')),  # Fatimanagar
    (Decimal('17.9840'), Decimal('79.5246')),  # Vishnu Nagar
    (Decimal('17.9876'), Decimal('79.5320')),  # Warangal Urban

    (Decimal('17.9698'), Decimal('79.5734')),  # Subedari
    (Decimal('17.9734'), Decimal('79.5748')),  # Revenue Colony
    (Decimal('17.9661'), Decimal('79.5679')),  # Thadakamalla
    (Decimal('17.9703'), Decimal('79.5794')),  # University Arts and Science College
    (Decimal('17.9647'), Decimal('79.5776')),  # Excise Colony

    (Decimal('17.9753'), Decimal('79.5810')),  # Nakkalagutta
    (Decimal('17.9711'), Decimal('79.5831')),  # Raghunathpally
    (Decimal('17.9738'), Decimal('79.5849')),  # Ambedkar Nagar
    (Decimal('17.9710'), Decimal('79.5853')),  # Pochamma Maidan
    (Decimal('17.9678'), Decimal('79.5869')),  # Kareemabad

    (Decimal('17.9972'), Decimal('79.5846')),  # Waddepally
    (Decimal('17.9993'), Decimal('79.5829')),  # Waddepally Lake
    (Decimal('17.9950'), Decimal('79.5821')),  # Sai Nagar
    (Decimal('17.9928'), Decimal('79.5806')),  # Bheemaram
    (Decimal('17.9873'), Decimal('79.5809')),  # Kothawada

    (Decimal('17.9724'), Decimal('79.5894')),  # Alankar
    (Decimal('17.9701'), Decimal('79.5878')),  # SR Nagar
    (Decimal('17.9683'), Decimal('79.5896')),  # Rangasaipet
    (Decimal('17.9690'), Decimal('79.5809')),  # Subhedari
    (Decimal('17.9733'), Decimal('79.5906')),  # Ekashila Nagar

    (Decimal('17.9759'), Decimal('79.5905')),  # MGM Hospital
    (Decimal('17.9737'), Decimal('79.5930')),  # Chowrastha
    (Decimal('17.9750'), Decimal('79.5936')),  # Palivelpula
    (Decimal('17.9748'), Decimal('79.5952')),  # Sahakara Nagar
    (Decimal('17.9716'), Decimal('79.5973')),  # Bhagyanagar

    (Decimal('17.9553'), Decimal('79.5968')),  # Kasibugga
    (Decimal('17.9567'), Decimal('79.5999')),  # Kasibugga Lake
    (Decimal('17.9519'), Decimal('79.5993')),  # Gopalapuram
    (Decimal('17.9550'), Decimal('79.5940')),  # Mamnoor
    (Decimal('17.9523'), Decimal('79.5935')),  # Kakatiya Institute of Technology and Science

    (Decimal('17.9538'), Decimal('79.5975')),  # Padmakshi Temple
    (Decimal('17.9602'), Decimal('79.5954')),  # Warangal Fort Entrance
    (Decimal('17.9615'), Decimal('79.5967')),  # Khammam Gate
    (Decimal('17.9633'), Decimal('79.5959')),  # Shambunipet
    (Decimal('17.9646'), Decimal('79.5963'))   # Bheemeshwara Temple
]

# Define time windows in integer format
time_windows = [
    (540, 1260), (615, 795),  (930, 1110), (645, 825),  (1005, 1185),
    (585, 765),  (885, 1065), (630, 810),  (1050, 1230), (555, 735),
    (765, 945),  (915, 1095), (645, 825),  (885, 1065), (735, 915),
    (795, 975),  (555, 735),  (645, 825),  (1020, 1200), (1065, 1245),
    (540, 1260), (555, 1245), (600, 1200), (615, 1230), (630, 1245),
    (645, 1260), (660, 1230), (675, 1245), (690, 1260), (705, 1230),
    (720, 1245), (735, 1260), (750, 1230), (765, 1245), (780, 1260),
    (795, 1230), (810, 1245), (825, 1260), (840, 1230), (855, 1245),
    (870, 1260), (885, 1230), (900, 1245), (915, 1260), (930, 1230),
    (945, 1260), (960, 1230), (975, 1245), (990, 1260), (1005, 1230)
]

# Define service times
service_times = [
    Decimal('0'), Decimal('15'), Decimal('20'), Decimal('18'), Decimal('22'),
    Decimal('17'), Decimal('25'), Decimal('19'), Decimal('14'), Decimal('20'),
    Decimal('24'), Decimal('28'), Decimal('13'), Decimal('30'), Decimal('16'),
    Decimal('27'), Decimal('12'), Decimal('23'), Decimal('21'), Decimal('18'),
    Decimal('10'), Decimal('18'), Decimal('25'), Decimal('22'), Decimal('19'),
    Decimal('16'), Decimal('30'), Decimal('21'), Decimal('17'), Decimal('26'),
    Decimal('14'), Decimal('18'), Decimal('19'), Decimal('15'), Decimal('23'),
    Decimal('20'), Decimal('22'), Decimal('24'), Decimal('15'), Decimal('19'),
    Decimal('21'), Decimal('13'), Decimal('18'), Decimal('22'), Decimal('25'),
    Decimal('20'), Decimal('17'), Decimal('16'), Decimal('24'), Decimal('18')
]
