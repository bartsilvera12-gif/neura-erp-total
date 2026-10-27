-- Total Electrodomesticos | paso 2: marcas + prolijidad de categorias
-- Correr DESPUES de importar el Excel en Inventario -> Importar.
-- Solo toca productos cuyo SKU es numerico (los de la lista vieja).
-- Idempotente: se puede correr dos veces sin duplicar nada.

DO $$
DECLARE v_emp uuid;
BEGIN
  SELECT id INTO v_emp FROM total.empresas LIMIT 1;

  -- 1) El importador crea las categorias nuevas en MAYUSCULA.
  --    Las paso a la misma capitalizacion que las que ya existian.
  --    El slug web no se recalcula en UPDATE, asi que no hay colision.
  UPDATE total.categorias_productos SET nombre='Muebles & Hogar', updated_at=now()
    WHERE empresa_id=v_emp AND nombre='MUEBLES & HOGAR';
  UPDATE total.categorias_productos SET nombre='Herramientas', updated_at=now()
    WHERE empresa_id=v_emp AND nombre='HERRAMIENTAS';
  UPDATE total.categorias_productos SET nombre='Limpieza', updated_at=now()
    WHERE empresa_id=v_emp AND nombre='LIMPIEZA';
  UPDATE total.categorias_productos SET nombre='Automotor', updated_at=now()
    WHERE empresa_id=v_emp AND nombre='AUTOMOTOR';
  UPDATE total.categorias_productos SET nombre='Varios', updated_at=now()
    WHERE empresa_id=v_emp AND nombre='VARIOS';

  -- 2) Crear las marcas que falten (match case-insensitive para no duplicar
  --    las que ya estaban cargadas, p.ej. Samsung vs SAMSUNG)
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ABBA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ABBA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'AIWA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('AIWA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ALTEZZA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ALTEZZA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'AMAZFIT', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('AMAZFIT'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ANSA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ANSA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'AOC', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('AOC'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'APPLE', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('APPLE'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ARNO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ARNO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ASPEN', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ASPEN'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ASUS', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ASUS'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ATHLETIC', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ATHLETIC'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ATLAS', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ATLAS'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'BABYLISS', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BABYLISS'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'BERTOLINI', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BERTOLINI'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'BESTWAY', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BESTWAY'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'BIONICA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BIONICA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'BLACK & DECKER', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BLACK & DECKER'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'BOSCH', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BOSCH'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'BRITANIA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BRITANIA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'BULER', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BULER'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'CADENCE', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CADENCE'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'CALOI', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CALOI'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'CARRIER', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CARRIER'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'CARVALHO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CARVALHO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'CHIQ', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CHIQ'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'COLEMAN', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('COLEMAN'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'COLORMAQ', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('COLORMAQ'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'COMFEE', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('COMFEE'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'CONSUL', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CONSUL'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'CONSUMER', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CONSUMER'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'CONTINENTAL', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CONTINENTAL'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'CROIX', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CROIX'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'DAEWOO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('DAEWOO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'DAKO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('DAKO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'DECOTEAM', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('DECOTEAM'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'DELL', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('DELL'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ELECTROBRAS', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ELECTROBRAS'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ELECTROLUX', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ELECTROLUX'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'EMTOP', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('EMTOP'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ENXUTA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ENXUTA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'FAMA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('FAMA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'FIORENZA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('FIORENZA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'FISHER-PRICE', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('FISHER-PRICE'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'FTX', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('FTX'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'GAMA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GAMA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'GAMMA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GAMMA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'GARMIN', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GARMIN'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'GASTROBRAS', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GASTROBRAS'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'GEISHA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GEISHA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'GOODWEATHER', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GOODWEATHER'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'GOOGLE', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GOOGLE'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'HAMILTON', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('HAMILTON'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'HAUSTEC', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('HAUSTEC'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'HISENSE', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('HISENSE'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'HONOR', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('HONOR'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'HUAWEI', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('HUAWEI'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'IMAR', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('IMAR'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'INTEX', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('INTEX'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'IRWIN', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('IRWIN'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'ITALUX', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ITALUX'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'JAM', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('JAM'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'JAMES', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('JAMES'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'JBL', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('JBL'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'KLIP XTREME', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('KLIP XTREME'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'KOLKE', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('KOLKE'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'KUMHO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('KUMHO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'LENOVO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('LENOVO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'LG', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('LG'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MABE', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MABE'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MAKITA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MAKITA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MALLORY', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MALLORY'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MATSUI', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MATSUI'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MEGA STAR', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MEGA STAR'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'METVISA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('METVISA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MIDAS', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MIDAS'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MIDEA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MIDEA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MOBLER', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MOBLER'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MONDIAL', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MONDIAL'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MOR', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MOR'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MOULINEX', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MOULINEX'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MOVAL', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MOVAL'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MUELLER', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MUELLER'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'MULTILASER', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MULTILASER'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'NAPPO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('NAPPO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'NINTENDO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('NINTENDO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'OSTER', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('OSTER'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'PANASONIC', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PANASONIC'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'PARANA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PARANA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'PEABODY', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PEABODY'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'PEDROLLO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PEDROLLO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'PHILIPS', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PHILIPS'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'PIONEER', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PIONEER'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'POLITORNO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('POLITORNO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'PROGAS', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PROGAS'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'QUANTA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('QUANTA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'REALME', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('REALME'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'REDMI', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('REDMI'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'REMINGTON', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('REMINGTON'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'SAMSUNG', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('SAMSUNG'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'SONY', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('SONY'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'SPEED', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('SPEED'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'STANLEY', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('STANLEY'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'SUGGAR', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('SUGGAR'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'SULPACK', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('SULPACK'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'TCL', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TCL'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'TECNO FITNESS', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TECNO FITNESS'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'TOKYO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TOKYO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'TOMASI', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TOMASI'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'TRAMONTINA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TRAMONTINA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'TRAPP', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TRAPP'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'UFESA', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('UFESA'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'VALCO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('VALCO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'VENANCIO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('VENANCIO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'VINIGAS', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('VINIGAS'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'WANKE', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('WANKE'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'WASKO', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('WASKO'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'WEBB', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('WEBB'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'WHIRLPOOL', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('WHIRLPOOL'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'WILLPEX', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('WILLPEX'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'XIAOMI', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('XIAOMI'));
  INSERT INTO total.marcas (empresa_id, nombre, activo) SELECT v_emp, 'XION', true WHERE NOT EXISTS (SELECT 1 FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('XION'));

  -- 3) Asignar la marca a cada producto, por SKU
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ABBA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2653','535','536','768','801','810','901','902','1442','1443','1444','1456','1579','1581','1582','1583','1652','1653','1655','1990','2161','2162','3409');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('AIWA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('95','117','122','123','147','148','335','392','395','396','881','3408','1661','1662','3377','2737','2738','3221','1663','3382','1664','1665','2626','1956','1964','1965','1978','2291','2369','2373','2374','2375','2376');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ALTEZZA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('144','145','643','645','2825','821','1164','1165','1229','1230','1231','1232','1233','1419','1448','2826','1649','2824','2823','1657','1953','1987','2908','2034','3059');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('AMAZFIT') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('1972','3297','1975','1976','1977');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ANSA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('1022','3307');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('AOC') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2372','2377','2378');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('APPLE') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('96','2758','2759','2926','403','3093','3103','3161','3247');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ARNO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('172','173','174','196','336','882','987','1240','1241','1335','3406','3407','2655','2656','1336','1337','1338','1339','1340','1341','1342','1344','1343','2970','2651','1345','1346','1566','1567','1839','1841','1842','2804','1853','1854','2671','3421','2453');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ASPEN') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2753','2752','1585','1586','1591','1592','2719','2317','2318','2682','2683','2320','2321','2322');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ASUS') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2732','3038','1593','3389','3390','3191','2975','3261','1594');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ATHLETIC') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('43','230','2718','497','3072','498','1565','2356');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ATLAS') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('501','502','519','520','2891','521','2893','2892','522','1023','1024','1025','1026','1027');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BABYLISS') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2568','2856','484','642','2857','2587','2747','2855','2663','1635','2952','1883','1881','1882','1884','1885','1886','2787','1887','1888','3193','2584','1889','1890','1891','1892','2633','1893','1894','1895','2092','2093','2094','2095','2748','2096','2097','2816','2098','3016','3060','3237','3238','2148','2153');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BERTOLINI') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('57');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BESTWAY') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('391','499','500','571','2760','572','573','574','575','782','797','867','1094','1095','1096','1097','1098','1099','1100','1101','1102','1103','1104','1105','1106','1107','1108','1109','1110','1111','1112','1113','1114','1115','1116','1117','1118','1119','1121','1334','1659','1781','1782','1783','1784','1785','1786','1787','1788','1789','1790','1791','1792','1793','1794','1795','1796','1797','1798','1799','1800');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BIONICA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('127','133','176','182','208','337','2862','823','828','831','842','851','2858','988','989','1028','1029','1030','1031','3172','1032','1349','1350','3213','1389','1528','1527','1613','1811','1812','3295','1818','1831','1832','3076','3075','1856','1857','1897','2042','2043','2790','2099','2347','2379','2788','2380','2819','2381','2666','2483','2484','2509','2546');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BLACK & DECKER') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('175','177','841','1347','1348','2736','1526','1609','1843','1844','1855','1858','1931','1933','2041','2301');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BOSCH') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3228','1898','2100','2890');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BRITANIA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3074','3073','2821','2846','3333','3185','2847','3144','3143','2810','3186','2811','3092','3145','2807','2812','3201','3202','3418','3199','3200','3417');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('BULER') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('1547');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CADENCE') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('178','179','197','843','1352','1353','1354','1400','2044','2348','2463','2464','2710','2510');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CALOI') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('231','232','233','234','235','2569','236','237','238','3232','239','240','241','242','2733','3381','243','3166','3345','244','245','246');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CARRIER') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('5','6','3044');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CARVALHO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3249','370','1458');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CHIQ') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('7','8','9','659','699','910');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('COLEMAN') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('701','2693','702','2454','2455','2456','2457','2458','2459');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('COLORMAQ') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('1940');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('COMFEE') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('10','11');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CONSUL') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('660','661','911','912','913','2659','1288');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CONSUMER') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('72','82','149','198','217','338','369','468','496','540','662','663','700','704','737','824','827','3257','832','833','3309','870','2684','2685','914','915','1011','2667','1035','1289','1311','1438','2627','3308','1465','1500','1524','1529','1667','1668','1669','1670','3310','2860','2265','2303','2363','2382','2487','2488','3095','3094','2536');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CONTINENTAL') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2583','504','526','781','916','917','918','919','1036','1466','1467','1941');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('CROIX') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3325','2843');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('DAEWOO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3279','94','658','785','3045','1012','1013','2851','1806','2154','2184');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('DAKO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3376','3259','505','3272','527','3255','528','529','530','2679','531','532','533','2938','534','1037','1038','1039');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('DECOTEAM') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2844','3324');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('DELL') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3117');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ELECTROBRAS') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3157','2942','3102','3353','2547');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ELECTROLUX') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('12','73','339','389','2730','506','3163','664','2638','665','666','667','3118','2896','920','921','922','923','924','925','926','927','2746','3151','990','1040','1243','1244','1245','1246','1247','3120','3104','2864','1356','1468','3164','1469','1470','2865','3192','1845','1859','1860','1861','1862','2577','2349','2350');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('EMTOP') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3098','2888','3091','3182','2886','2879','3419');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ENXUTA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('13','668','928','929','2631','1248','1249','1471','1472','3216','2383','2384');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('FAMA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('14','2630','340','341','669','844','2101','2919','2920','2918','3424');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('FIORENZA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('278','279','280','281','282','283','284','285','286','287');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('FISHER-PRICE') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('855');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('FTX') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3054','3081','3106','3040','3171','3314','3265','3109','2734','2735','2813','2451');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GAMA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('46','47','48','49','50','2628','134','153','154','3052','486','487','644','707','708','709','710','711','712','713','714','715','716','717','718','749','750','751','774','775','1638','1639','1640','1641','1642','1643','1772','1901','1902','1903','1904','1905','1906','3239','1907','1908','1909','1910','1911','1912','2102','2103','2104','2105','2106','3047','2107','2108','2109','2110','2111','3048','2316','2319');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GAMMA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2602','74','75','76','2586','2965','2603','2600','2599','2585','2565');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GARMIN') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3008');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GASTROBRAS') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3116','3152','3115','3361','3346');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GEISHA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('1437','1439');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GOODWEATHER') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('15','16','17','18','2618','19','20','2629','673','674','2980','754','857','933','934','3423','935','982','1042','3422','3425','2882','2539','2540','2956');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('GOOGLE') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('494','2385','2389','3271','2420','2835','3405','2445','3141','2441','3022','3388','2681','2848','3242','3234');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('HAMILTON') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('180','181','343','1355','1357','1358','1359','1360','1530','2351');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('HAUSTEC') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('21','22','23','24','2660','3133');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('HISENSE') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3283');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('HONOR') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2969','3233','3286');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('HUAWEI') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('402');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('IMAR') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3209');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('INTEX') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3394','3393','3395','1120','1122');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('IRWIN') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3003');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('ITALUX') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2829','746','747','850','2040');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('JAM') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('25','26','27','28','29','219','3243','469','507','544','545','546','547','548','675','676','677','678','2951','845','936','937','2754','938','939','991','992','993','1043','1044','1045','1046','1047','1048','1049','1050','1250','1251','1252','1253','1254','1290','1362','1473','1474','1475','1476','2591','1833','1834','3212','1835','1864','1865','1934','1935','2045','2046','2052','2051','2141','3244','2333','2334','2386','2387','2388','2390','2391','2392','2473','2729','2491','2492','2519','2541');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('JAMES') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('1310');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('JBL') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('97','2953','98','99','100','101','102','2836','3245','2769','2837','3053','367','366','2800','3240','1671','1672','1673','1674','1675','1676','1677','3122','3293','3248','1678','1679','1680','1681','1682','1683','2649','2650','1684','1685','1686','1687','1688','1689','1690','1691','1692','1693','1694','1695','3384','2643','2642','1696','1697','1698','1699','1700','1701','1702','1703','2646','2648','2647','2645','1704','2580','2695','1705','3349','1706','2612','3173','1707','3236','1708','2954','3292','3412','1709','2884','2674','1710','1711','1712','1713','2727','2365');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('KLIP XTREME') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('103','104','105','106','107','2276','2277','2278');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('KOLKE') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('108','109','110','111','112','113','332','387','2875','1716','3018','1717','3029','1718','1719','3017','1720','2786','1721','1722','1723','2764','3020','3019','1724','1725','1726','1727','1728','1729','1730','1731','1732','1733','1734','1735','1979','2963','2266','2267','2269','2268','2270','2271','2272','2273','2274','2275','2279','2286','2366','2397','2398','2399','2400');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('KUMHO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('757','758','759','760','761','762');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('LENOVO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3207');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('LG') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2697','1255','1256','1257','2937','1504','1505','1506','1507','1508','1509','1510','1511','2669','2670','1522','1523','1736','1737','2852','1738','1739','2015','2020','2026','2402','2404','2405','2403','2406','2407','2408','2782','2409','2802','2842','2637');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MABE') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('508','940','941','942','943','2582','944','1258','1259','1260','1942','2142');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MAKITA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2611','69','68','3273','2906','2155','2156','2305');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MALLORY') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2575','1363','1866','2467','2468','2469','2495');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MATSUI') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('184','1478','1479','1819','2410','2411','2412');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MEGA STAR') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('78','2925','118','2589','119','120','121','2935','129','135','185','186','211','3305','354','3306','470','2959','509','541','3149','790','829','830','2601','872','883','884','945','3077','995','996','1016','1052','1053','1054','2904','2903','1090','1364','1365','1366','1367','1414','1415','1416','1417','2924','1424','1425','1426','3187','1436','1440','1463','1939','1531','1542','1587','1602','2943','2636','1610','1611','1614','1634','1645','1660','1740','1741','1742','1743','2702','1744','1745','1746','1747','1748','1749','1750','1751','1752','1753','1754','1762','1755','1756','1757','1758','1759','1760','1761','1765','1809','1820','3350','1821','1822','2721','1958','1959','2988','1960','1962','1961','1963','1966','2634','2047','2053','2635','2112','2113','2114','2312','2323','2324','2325','2367','2665','2413','2414','2470','2476','2477','2496','2497','2498','2531','2532','2533','2987','2548');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('METVISA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3223','748','1361');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MIDAS') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('31','3428','32','33','34','2774','220','2948','471','2724','3396','2739','2740','549','3082','679','680','681','3083','682','3084','3256','2775','947','946','948','949','950','951','952','3397','2831','953','954','955','2850','1055','1056','2981','1057','1058','3014','1059','1088','1261','1262','1263','1264','3294','1265','1266','3015','1267','2578','3426','1291','2561','2562','1368','1369','1480','1481','2750','1482','1715','3085','1763','2706','1813','1836','1837','2751','1867','2749','2054','2055','2415','2416','2417','2833','2421','2834','2579','2499','2521','2542');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MIDEA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('35','3110','80','79','187','3253','199','212','213','221','222','3089','390','3369','3041','683','684','685','3254','686','687','688','2973','796','3258','3373','3372','885','3371','886','960','956','957','958','959','961','962','963','964','965','3370','983','984','997','998','2624','2576','3088','2604','1268','1269','1270','3175','2927','1327','1328','1370','1371','1372','1484','1483','3225','3224','3416','1485','1486','1487','2703','1502','1532','1543','1568','1569','1810','1943','1944','2143','2144','2574','3229','3181','2573','2500','2543','2544');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MOBLER') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('802','803','1651');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MONDIAL') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('130','188','189','190','191','200','201','202','214','344','345','346','348','347','480','481','482','488','489','490','491','492','510','719','720','721','722','2941','846','852','853','875','1060','1373','1374','1375','1376','1377','1378','1379','1391','1433','1533','1534','1535','2723','1570','1603','1608','3260','1846','1847','1914','1915','1916','2115','2116','2117','3276','2452','2471','2472','2512','2549');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MOR') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3402','1801','1802','1803','1804','1805','2168','2313','3343');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MOULINEX') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2632','349','350','351','3241','352','353','2619','3398','2700','2977','2707','1380','1434','3176','1774','1775','1936');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MOVAL') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2955','2985','2032','2033','2899','2898','2652');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MUELLER') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('472','473','474','475','511','512','542','550','551','553','552','554','555','556','557','559','558','560','3165','561','562','2657','1061','1062','1063','1064','1065','1066','3148','3156','1067','1068','1069','1070','1071','1271','2711','1272','1292','1293','1294','1295','1296','1297','1298','1299','1300','1301','1302','3210','3211','1303','1304','1305','1307','1306','1308','1309','1312','2138','2139');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('MULTILASER') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('355','887','888','1381','1382','1383','1778','2292','2293','2294','2352');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('NAPPO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3027','81','3339','136','137','138','139','203','204','320','2770','356','357','2784','755','2957','876','877','878','2966','889','890','2961','3031','2962','3278','1015','2863','1017','2767','2783','2766','2763','1166','1170','1234','1235','1236','2768','1239','1384','1401','3218','1554','2803','1773','3338','1779','3354','2048','2118','2876','2300','2304','2353');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('NINTENDO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3127');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('OSTER') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('1385','1386','1868');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PANASONIC') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('1512','1513','1514','2309','2310','2311');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PARANA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('63','64','65','66','162','155','156','159','160','161','163','164','165','166','167','168','322','323','324','325','326','327','328','329','330','570','576','577','578','579','580','581','582','583','584','2687','585','586','587','588','589','590','591','592','593','3153','594','595','596','597','598','599','600','601','602','603','605','3169','606','2964','607','608','2950','609','610','611','612','613','3170','614','615','616','617','2608','2607','618','619','621','622','623','624','625','626','627','628','629','630','2756','631','632','633','2928','3348','634','635','636','637','638','639','2186','2187','2188','2189','2214','2717','2594','2215','2216','2217','2218','2219','2220','2930','2221','2222','2223','2224','2225','2929','2226','2227','2228','2229','2230','2231','2232','2233','2234','2235','2236','2237','2238','2239','2240','2944','2241','2242','2243','2244','3250','2245','2246','2247','2806','2798','3246','2248','2249','2250','2661','2251','2606','2252','2253','3026','2897','2254','2255','2256','2257','2258','2259','2260','2261','2262','2263','2264');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PEABODY') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('192','193','205','358','891','892','1387','2791','1388','1537','1776','1848','1863','2056','2327','2328','2329','2330');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PEDROLLO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3231');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PHILIPS') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('51','52','2949','53','54','2581','55','114','150','194','195','706','723','724','725','726','736','752','753','776','777','778','779','2622','893','1392','1393','1394','1395','1396','1397','1398','1399','1515','1516','1538','1571','1572','1573','1574','1646','1647','1840','1849','1869','1870','1871','1917','1937','1938','1967','1968','2124','2125','2126','2354','2355','2422');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PIONEER') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('124','125','1764','2289');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('POLITORNO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('146','1447','2344','2345','2556','2557');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('PROGAS') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3174','879','3362','3363');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('QUANTA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3227','359','3219','388','705','1089','1390','1461','1462','1464','2931','1971','2280','2281','2282','2283','2284','2343');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('REALME') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2623');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('REDMI') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('115','466');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('REMINGTON') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('56','3299','3298','3300','2699','646','727','728','729','730','731','732','733','1648','1918','1919','1920','1921','1922','1923','2127','2128','2129','2130','2131','2132');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('SAMSUNG') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('397','404','405','406','407','408','409','410','411','412','413','414','415','416','417','418','419','420','421','2614','422','423','3039','3288','424','425','426','427','428','429','430','431','432','433','434','435','436','437','2797','2872','3364','3302','3220','438','439','440','441','442','443','444','445','446','447','448','2839','2945','449','450','451','452','3071','453','454','2967','455','456','3011','2762','467','966','967','1273','1274','1329','1330','1488','1974','3065','2295','3124','2427','2428','2429','2430','2431','3125','2432','2673','2615','2433','3194','3055');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('SONY') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2796','1503','1517','1766');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('SPEED') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('38','39','83','84','131','2664','3037','223','360','368','493','791','792','2859','880','968','969','1002','1003','1073','1074','1075','1076','1402','1403','1404','1489','3096','3097','1519','1520','1521','1823','1824','1872','1873','1969','2058','2140','2335','2434','2435','2478','2524');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('STANLEY') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2989','2895','905','906','1238','2331','2332');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('SUGGAR') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3179');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('SULPACK') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3336');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TCL') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2296','2297');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TECNO FITNESS') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('44','247','248','2725');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TOKYO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('4','40','41','42','2726','85','86','87','2990','2974','126','132','140','141','152','206','207','216','2698','3274','224','2692','361','362','363','476','2559','2809','2720','513','2641','514','515','2572','2570','525','543','3050','3049','564','565','3326','3327','641','689','694','690','2999','3000','3021','691','692','693','695','696','698','3002','697','3001','3311','3222','793','826','834','3312','840','847','848','849','854','894','895','896','897','898','899','900','3023','971','972','973','970','2877','974','975','976','977','985','1004','1005','1006','1007','1008','3025','1041','3328','1077','1078','1079','2743','1080','3404','1081','1082','1083','1084','1085','2741','2742','1086','2571','1087','2878','2596','3032','1275','3434','3435','3436','3437','1276','3034','1277','1278','1314','1315','2805','1316','1317','1318','1319','3033','1405','1406','1407','1408','1409','1410','1411','1412','1413','1449','1490','1491','1492','1493','1494','1495','1539','1544','1575','1588','1589','1590','3296','1612','1767','1768','1780','3043','1814','1815','1816','1817','1825','1826','2597','1827','1828','1829','1830','1874','1875','1876','1879','1947','1946','3188','1948','3183','1957','1970','2050','3160','2059','2060','2061','2147','2145','2818','2625','2336','2337','2339','2436','2437','2438','2439','2440','2442','2443','2444','2479','2480','2481','3189','2505','2960','2506','2507','2508','2513','2525','2526','2527','3028','2976','3057');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TOMASI') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('907','908');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TRAMONTINA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3320','296','297','298','299','300','301','302','303','304','305','306','307','308','309','310','314','315','2996','3007','333','334','2994','2993','764','3006','788','3099','2914','1009','2913','1010','2686','2609','3136','1142','1145','3366','1146','1147','1149','1150','1151','1152','1153','1154','1155','1156','1157','1158','1159','1160','1161','1162','1163','2779','2781','2780','3206','3205','3204','2566','1167','3203','1171','2997','2773','3024','3010','1172','1173','1174','1175','1176','2912','1177','1178','1179','1180','1181','1182','1183','1184','1185','1186','1187','1188','1189','1190','1191','2916','2911','1201','1202','1203','1204','1205','1206','1209','1210','1211','1212','1213','1214','1215','1216','1217','1218','2815','2778','1607','1616','1617','1618','1619','1620','1621','1622','1623','1624','1625','1626','1627','1628','1629','1630','2887','1631','1632','1633','3012','3058','3365','2995','2915','2079','2080','2081','2082','2083','2084','2085','2086','2087','2088','3280','3281','3208','3414','2610','2314');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('TRAPP') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('316','317','318','319','3159','740','741','742','743','744','798','1237','1924');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('UFESA') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('142','2644','2567','3427','1850','1851','1852','1877','1878','3351');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('VALCO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('1550','3230','1551','1552','2765','1549','2901','2308');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('VENANCIO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('495');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('VINIGAS') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('1429','1430');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('WANKE') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('2883','477','478','479','1320','1322','1323','2827','1321','2828','2146');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('WASKO') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('91','88','89','90','92','93','3277','2654','745','789','904','1018','2705','1019','1020','1021','2185');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('WEBB') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3317');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('WHIRLPOOL') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('568','978','979','2799','980','2832','981','3051','1279','1280','1281','3150','1282','2694','1284','1283','1285','1286','3108','1325','1326','1331','1332','1333','1496','1497','2940','1498','1499','2722','2592','1945');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('WILLPEX') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3268','3269','1431','1432');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('XIAOMI') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3195','3196','3415','3180','457','2639','3177','2564','2563','2676','2789','2971','3064','3100','458','459','460','461','462','463','3140','3383','464','465','2613','3137','2771','3154','3235','2755','2371','2689');
  UPDATE total.productos SET marca_id = (SELECT id FROM total.marcas WHERE empresa_id=v_emp AND upper(nombre)=upper('XION') LIMIT 1), updated_at=now()
    WHERE empresa_id=v_emp AND sku IN ('3347','2923','2921','2777','2830','2998','2958');

END $$;

NOTIFY pgrst, 'reload schema';
