/**
 * Spanish strings, keyed by the English source text used in code. Chicago
 * Spanish: "distrito" for a ward the way the city's own ballots say it,
 * "concejal" for alderman. Candidate statements are not in here on purpose.
 * A missing key renders the English, so nothing ever goes blank.
 */
export const ES: Record<string, string> = {
  // Tabs
  'big board': 'tablero',
  wards: 'distritos',
  election: 'elecciones',
  notifications: 'avisos',
  profile: 'perfil',

  // Election tab header
  'Your next two ballots: who is running, what they say, and when and where to vote.':
    'Tus próximas dos boletas: quién se postula, qué dicen, y cuándo y dónde votar.',
  'nov 3 ballot': 'boleta del 3 nov',
  'state & county races': 'estado y condado',
  'school board': 'consejo escolar',
  '21 seats on nov 3': '21 puestos el 3 nov',
  judges: 'jueces',
  'retention & vacancies': 'retención y vacantes',
  'your districts': 'tus distritos',
  'congress & state': 'congreso y estado',
  'mayoral ama': 'ama de alcaldía',
  'ask every candidate': 'pregunta a todos',
  'ward races': 'concejales',
  'aldermen & police': 'y consejos policiales',
  'race for mayor': 'carrera por la alcaldía',
  "Every candidate's full platform, debated plank by plank.":
    'La plataforma completa de cada candidato, debatida punto por punto.',
  'No candidates on the platform yet.': 'Aún no hay candidatos en la plataforma.',

  // Countdown
  'Early voting starts downtown': 'Votación anticipada en el centro',
  'Last day to register by mail': 'Último día para registrarse por correo',
  'Last day to register online': 'Último día para registrarse en línea',
  'Early voting opens in every ward': 'Votación anticipada en cada distrito',
  'Last day to apply for a mail ballot': 'Último día para pedir boleta por correo',
  'Election day': 'Día de elección',
  'Municipal election day': 'Día de la elección municipal',
  today: 'hoy',
  tomorrow: 'mañana',
  'election day in': 'día de elección en',

  // Mayoral AMA
  'mayoral candidate ama': 'ama con candidatos a alcalde',
  'One question, every candidate on the record. Answers land side by side, ranked by your votes.':
    'Una pregunta, todos los candidatos en el registro. Las respuestas aparecen lado a lado, ordenadas por tus votos.',
  'Ask every candidate at once…': 'Pregúntales a todos los candidatos a la vez…',
  'Put it to the candidates': 'Enviar a los candidatos',
  'Sign in to ask': 'Inicia sesión para preguntar',
  'No questions yet. Ask the first one and put the whole field on the record.':
    'Aún no hay preguntas. Haz la primera y pon a todos los candidatos en el registro.',
  'candidate has answered': 'candidato ha respondido',
  'candidates have answered': 'candidatos han respondido',

  // School board section
  'All 21 board seats are on the November 3, 2026 ballot. You vote in two races: board president and your district\'s seat.':
    'Los 21 puestos del consejo están en la boleta del 3 de noviembre de 2026. Votas en dos carreras: presidente del consejo y el puesto de tu distrito.',
  "Your district's seat": 'El puesto de tu distrito',
  'Not sure which district? Look up your address': '¿No sabes tu distrito? Busca tu dirección',
  candidate: 'candidato',
  candidates: 'candidatos',

  // November section
  'your november 3 ballot': 'tu boleta del 3 de noviembre',
  'The statewide and Cook County offices every Chicagoan votes on, and the dates and places to cast a ballot. Judges and district races follow below.':
    'Los cargos estatales y del condado de Cook que vota todo Chicago, y las fechas y lugares para votar. Los jueces y las carreras por distrito siguen abajo.',
  'When and where to vote': 'Cuándo y dónde votar',
  Register: 'Regístrate',
  'online through October 18 (needs an Illinois license or state ID), by mail through October 6, or in person through election day itself, at any early voting site or polling place, with two forms of ID (one showing your address).':
    'en línea hasta el 18 de octubre (requiere licencia o identificación de Illinois), por correo hasta el 6 de octubre, o en persona hasta el mismo día de la elección, en cualquier sitio de votación anticipada o lugar de votación, con dos identificaciones (una con tu dirección).',
  'Register or check your registration': 'Regístrate o revisa tu registro',
  'Vote by mail': 'Vota por correo',
  'apply by October 29, 5 pm; ballots start mailing September 24; return by mail or at any secured drop box (one at every ward early voting site).':
    'solicita antes del 29 de octubre a las 5 pm; las boletas se envían desde el 24 de septiembre; devuélvela por correo o en cualquier buzón seguro (hay uno en cada sitio de votación anticipada de distrito).',
  'Apply for a mail ballot': 'Pide una boleta por correo',
  'Track your mail ballot': 'Rastrea tu boleta por correo',
  'Vote early': 'Vota anticipado',
  'downtown from October 1 (137 S. State St.), all 50 wards from October 19; any Chicago voter can use any site.':
    'en el centro desde el 1 de octubre (137 S. State St.), en los 50 distritos desde el 19 de octubre; cualquier votante de Chicago puede usar cualquier sitio.',
  'Early voting sites': 'Sitios de votación anticipada',
  'Election day: Tuesday, November 3': 'Día de elección: martes 3 de noviembre',
  'Polls are open 6 am to 7 pm, at your precinct or any vote center in the city.':
    'Las urnas abren de 6 am a 7 pm, en tu precinto o en cualquier centro de votación de la ciudad.',
  'Find your polling place': 'Encuentra tu lugar de votación',
  'United States Senate': 'Senado de Estados Unidos',
  'The open seat Dick Durbin is retiring from after 30 years.': 'El escaño que Dick Durbin deja tras 30 años.',
  'Governor & Lieutenant Governor': 'Gobernador y Vicegobernador',
  "Illinois' chief executive, elected statewide as a ticket.": 'El ejecutivo de Illinois, elegido en fórmula en todo el estado.',
  'Attorney General': 'Fiscal General',
  "The state's chief legal officer.": 'El principal abogado del estado.',
  'Secretary of State': 'Secretario de Estado',
  'Runs the DMV, business registrations, and state records.': 'Dirige el DMV, los registros de empresas y los archivos del estado.',
  Comptroller: 'Contralor',
  "Pays the state's bills; an open seat in 2026.": 'Paga las cuentas del estado; escaño abierto en 2026.',
  Treasurer: 'Tesorero',
  "Invests the state's money.": 'Invierte el dinero del estado.',
  'President, Cook County Board': 'Presidente de la Junta del Condado de Cook',
  "The county's chief executive: budget, health system, jail.": 'El ejecutivo del condado: presupuesto, sistema de salud, cárcel.',
  'Cook County Assessor': 'Tasador del Condado de Cook',
  'Sets the property values your tax bill is built on; an open seat after the incumbent lost his primary.':
    'Fija el valor de las propiedades que determina tu impuesto; escaño abierto tras la derrota del titular en la primaria.',
  'Cook County Treasurer': 'Tesorero del Condado de Cook',
  'Collects and distributes property taxes.': 'Cobra y distribuye los impuestos a la propiedad.',
  'Cook County Sheriff': 'Alguacil del Condado de Cook',
  'Runs the county jail and sheriff police.': 'Dirige la cárcel del condado y la policía del alguacil.',
  'Cook County Clerk': 'Secretario del Condado de Cook',
  'Vital records, property tax rates, and suburban elections.': 'Registros vitales, tasas de impuestos y elecciones suburbanas.',
  'MWRD Commissioners': 'Comisionados del MWRD',
  'The water reclamation board: sewage and flood control. You vote for three of the six-year seats.':
    'La junta de aguas: drenaje y control de inundaciones. Votas por tres de los puestos de seis años.',
  'MWRD Commissioner (2-year seat)': 'Comisionado del MWRD (puesto de 2 años)',
  'A separate ballot line filling an unexpired term.': 'Una línea aparte en la boleta para un término incompleto.',
  'Advisory question: a statewide "millionaire tax"': 'Pregunta consultiva: un "impuesto a millonarios" estatal',
  'Shall Illinois adopt a 3% income tax surcharge on income over $1 million, with half the revenue for property tax relief and half for public school funding? Advisory only - the result binds nobody, it measures support.':
    '¿Debe Illinois adoptar un recargo del 3% al ingreso mayor de $1 millón, con la mitad para aliviar impuestos a la propiedad y la mitad para escuelas públicas? Solo consultiva: el resultado no obliga a nadie, mide el apoyo.',

  // Judges section
  'The longest part of the ballot and the least known. Read Injustice Watch before you vote; the lists and ratings here are the shortcut back to it.':
    'La parte más larga de la boleta y la menos conocida. Lee Injustice Watch antes de votar; las listas y calificaciones aquí son el atajo para volver a ella.',
  'Injustice Watch judicial guide': 'Guía judicial de Injustice Watch',
  "Independent reporting on every judge on the ballot: their records, controversies, and the bar associations' findings, in one place. The full 2026 guide publishes in late September.":
    'Periodismo independiente sobre cada juez en la boleta: su historial, controversias y las evaluaciones de los colegios de abogados, en un solo lugar. La guía completa de 2026 sale a fines de septiembre.',
  'Open the guide': 'Abrir la guía',
  'Judges up for retention': 'Jueces en votación de retención',
  'A yes-or-no vote on every sitting judge whose term is ending.': 'Un voto de sí o no por cada juez cuyo término termina.',
  'Appellate Court, First District': 'Corte de Apelaciones, Primer Distrito',
  'Vacancies on the court that hears appeals from Cook County.': 'Vacantes en la corte que atiende apelaciones del condado de Cook.',
  'Circuit Court, countywide vacancies': 'Corte de Circuito, vacantes de todo el condado',
  'Trial judges elected by the whole county.': 'Jueces de primera instancia elegidos por todo el condado.',
  "Your subcircuit's vacancies": 'Las vacantes de tu subcircuito',
  'Some trial judges are elected by one part of the county. Your sample ballot names your subcircuit.':
    'Algunos jueces se eligen por una parte del condado. Tu boleta de muestra indica tu subcircuito.',
  'Look up your sample ballot': 'Busca tu boleta de muestra',
  judge: 'juez',
  'judges ': 'jueces',
  'Every Cook County judge up for retention needs a yes from 60 percent of voters to keep the job. Bar associations screen each one; Injustice Watch reports on their records.':
    'Cada juez del condado de Cook en retención necesita el sí del 60 por ciento de los votantes para seguir. Los colegios de abogados evalúan a cada uno; Injustice Watch reporta su historial.',
  'Chicago Bar Association evaluations': 'Evaluaciones del Colegio de Abogados de Chicago',

  // Districts section
  'Congress, the state legislature, and county seats are drawn by district, not ward. Your sample ballot names yours; every district that touches the city is here.':
    'El Congreso, la legislatura estatal y los puestos del condado se dividen por distrito legislativo, no por distrito municipal. Tu boleta de muestra indica el tuyo; aquí están todos los que tocan la ciudad.',
  'Look up your districts by address': 'Busca tus distritos por dirección',
  'District races are being added; check back shortly.': 'Las carreras por distrito se están agregando; vuelve pronto.',
  'US House of Representatives': 'Cámara de Representantes de EE. UU.',
  'Chicago is split across nine congressional districts.': 'Chicago se reparte en nueve distritos congresionales.',
  'Illinois Senate': 'Senado de Illinois',
  'Only some Senate seats are up this year.': 'Solo algunos escaños del Senado se votan este año.',
  'Illinois House': 'Cámara de Illinois',
  'Every House seat is up.': 'Se votan todos los escaños de la Cámara.',
  'Cook County Commissioner': 'Comisionado del Condado de Cook',
  'The county board; every district is up.': 'La junta del condado; se votan todos los distritos.',
  'Cook County Board of Review': 'Junta de Revisión del Condado de Cook',
  'Hears property assessment appeals.': 'Atiende apelaciones de tasación de propiedades.',
  'Circuit Court, subcircuit vacancies': 'Corte de Circuito, vacantes por subcircuito',
  'Trial judges elected by one part of the county.': 'Jueces elegidos por una parte del condado.',

  // Ward races section
  'ward races - february 2027': 'concejales - febrero 2027',
  "Every alderman's seat and every police district council is on the February 23, 2027 ballot with the mayor's race above. Candidates file October 19-26, 2026; candidates appear here as they declare.":
    'Cada puesto de concejal y cada consejo de distrito policial está en la boleta del 23 de febrero de 2027, junto con la alcaldía arriba. Los candidatos se inscriben del 19 al 26 de octubre de 2026; aparecen aquí conforme se declaran.',
  'City Clerk': 'Secretario Municipal',
  "Keeps the city's records and runs city vehicle stickers.": 'Guarda los registros de la ciudad y administra las calcomanías vehiculares.',
  'City Treasurer': 'Tesorero Municipal',
  "Manages the city's cash and pension investments.": 'Administra el efectivo y las inversiones de pensiones de la ciudad.',
  'Your ward': 'Tu distrito',
  'Your last pick': 'Tu última elección',
  "Your alderman's record next to everyone running against them.": 'El historial de tu concejal junto a todos los que compiten en su contra.',
  "Every ward's race": 'La carrera de cada distrito',
  'Highlighted wards have declared candidates on record.': 'Los distritos resaltados tienen candidatos declarados.',
  'Police district councils': 'Consejos de distrito policial',
  'Three elected seats in each of the 22 police districts, on the same February ballot. Police districts do not follow ward lines; your sample ballot names yours.':
    'Tres puestos electos en cada uno de los 22 distritos policiales, en la misma boleta de febrero. Los distritos policiales no siguen los límites municipales; tu boleta de muestra indica el tuyo.',

  // Dates
  'November 3, 2026': '3 de noviembre de 2026',
  'February 23, 2027': '23 de febrero de 2027',

  'No candidates are on record yet. Filing runs October 19-26, 2026; the districts fill in here as candidates declare.':
    'Aún no hay candidatos registrados. La inscripción es del 19 al 26 de octubre de 2026; los distritos se llenan aquí conforme los candidatos se declaran.',

  // Race screen
  'Race not found.': 'Carrera no encontrada.',
  'on the ballot': 'en la boleta del',
  'is running unopposed.': 'se postula sin oposición.',
  'judges. Each is a separate yes-or-no question on your ballot.': 'jueces. Cada uno es una pregunta aparte de sí o no en tu boleta.',
  Incumbent: 'Titular',
  'No candidates listed for this race yet.': 'Aún no hay candidatos en esta carrera.',

  // Candidate screen
  'Candidate not found.': 'Candidato no encontrado.',
  'Campaign site': 'Sitio de campaña',
  'Copy campaign site link': 'Copiar enlace del sitio de campaña',
  Ratings: 'Calificaciones',
  'As published by each screening body; tap one to read its evaluation.': 'Tal como las publica cada organismo evaluador; toca una para leer su evaluación.',
  Record: 'Historial',
  'Running on': 'Se postula por',
  Background: 'Trayectoria',
  'Compiled from public sources:': 'Compilado de fuentes públicas:',

  // Ward race screen
  race: 'carrera',
  'Alderman, on the ballot': 'Concejal, en la boleta del',
  'Candidates file October 19-26, 2026': 'Los candidatos se inscriben del 19 al 26 de octubre de 2026',
  'The incumbent': 'El titular',
  'Running for re-election. Their record here is the community grading them.': 'Busca la reelección. Su historial aquí es la comunidad calificándolo.',
  'Their record here is the community grading them.': 'Su historial aquí es la comunidad calificándolo.',
  "What they say they're running on": 'Por qué dice que se postula',
  'Declared challengers': 'Retadores declarados',
  Challengers: 'Retadores',
  'No declared challengers on record here yet. Petitions are circulating across the city; this page fills in as candidates go public and file.':
    'Aún no hay retadores declarados aquí. Las peticiones circulan por toda la ciudad; esta página se llena conforme los candidatos se anuncian e inscriben.',
  'Ward not found.': 'Distrito no encontrado.',

  policy: 'política',
  policies: 'políticas',

  // Settings
  Language: 'Idioma',
  'Privacy & data': 'Privacidad y datos',
};
