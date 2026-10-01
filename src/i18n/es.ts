/**
 * Spanish strings, keyed by the English source text used in code. Chicago
 * Spanish: "distrito" for a ward the way the city's own ballots say it,
 * "concejal" for alderman. Candidate statements are not in here on purpose.
 * A missing key renders the English, so nothing ever goes blank.
 */
export const ES: Record<string, string> = {
  // Tabs
  'big board': 'tablero',
  home: 'inicio',
  wards: 'distritos',
  election: 'elecciones',
  notifications: 'avisos',
  profile: 'perfil',
  command: 'mando',

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
  'mayoral ama': 'AMA de alcaldía',
  'ask every candidate': 'pregunta a todos',
  'ward races': 'concejales',
  'aldermen & police': 'y consejos policiales',
  'race for mayor': 'carrera por la alcaldía',
  "Every candidate's full platform, debated plank by plank.":
    'La plataforma completa de cada candidato, debatida punto por punto.',
  'No candidates on the platform yet.': 'Aún no hay candidatos en la plataforma.',

  // Countdown: labels are verb phrases completed by today/tomorrow/in N days.
  'Early voting starts': 'La votación anticipada empieza',
  'Mail registration closes': 'El registro por correo cierra',
  'Online registration closes': 'El registro en línea cierra',
  'Early voting opens in every ward': 'La votación anticipada abre en cada distrito',
  'Mail ballot applications close': 'Las solicitudes de boleta por correo cierran',
  'General election day is': 'El día de la elección general es',
  'Municipal election day is': 'El día de la elección municipal es',
  today: 'hoy',
  tomorrow: 'mañana',
  'days until the general election': 'días para la elección general',
  'day until the general election': 'día para la elección general',
  'days until the municipal election': 'días para la elección municipal',
  'day until the municipal election': 'día para la elección municipal',

  // Mayoral AMA
  'mayoral candidate ama': 'AMA con candidatos a alcalde',
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
  'apply by October 29; ballots start mailing September 24; return by mail or at any secured drop box (one at every ward early voting site).':
    'solicita a más tardar el 29 de octubre; las boletas se envían desde el 24 de septiembre; devuélvela por correo o en cualquier buzón seguro (hay uno en cada sitio de votación anticipada de distrito).',
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
  "Independent reporting on every judge on the ballot: their records, controversies, and the bar associations' findings, in one place.":
    'Periodismo independiente sobre cada juez en la boleta: su historial, controversias y las evaluaciones de los colegios de abogados, en un solo lugar.',
  'Negative rating from 1 bar association': 'Calificación negativa de 1 colegio de abogados',
  'Negative ratings from {n} bar associations': 'Calificaciones negativas de {n} colegios de abogados',
  '{n} with a negative bar rating': '{n} con calificación negativa de colegios de abogados',
  'Negative bar ratings for candidates in subcircuits {list}': 'Calificaciones negativas de colegios de abogados para candidatos en los subcircuitos {list}',
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

  'No candidates are on record yet. Candidates file October 19-26, 2026; the districts fill in here as they declare.':
    'Aún no hay candidatos registrados. La inscripción es del 19 al 26 de octubre de 2026; los distritos se llenan aquí conforme los candidatos se declaran.',

  // Race screen
  'Race not found.': 'Carrera no encontrada.',
  'on the ballot': 'en la boleta del',
  'is running unopposed.': 'se postula sin oposición.',
  'is the only name printed on the ballot.': 'es el único nombre impreso en la boleta.',
  'Write-in': 'Por escrito',
  'Write-in candidates': 'Candidaturas por escrito',
  "These names are not printed on the ballot. To vote for one, write the name in the blank write-in space for that office and fill in the oval (on a touchscreen, follow the write-in steps on screen). Votes count only for write-ins who filed a declaration. The Chicago Board of Elections does not post those names, so this list comes from the Cook County Clerk's list and campaign announcements; election judges at your polling place have the official one.":
    'Estos nombres no aparecen impresos en la boleta. Para votar por uno, escribe el nombre en el espacio en blanco para votos por escrito de ese cargo y llena el óvalo (en la pantalla táctil, sigue los pasos para votos por escrito). Solo cuentan los votos por escrito de quienes presentaron una declaración. La Junta Electoral de Chicago no publica esos nombres, así que esta lista viene de la lista de la Oficina del Secretario del Condado de Cook y de anuncios de campaña; los jueces electorales de tu lugar de votación tienen la oficial.',
  'How to mark your ballot (Board of Elections)': 'Cómo marcar tu boleta (Junta Electoral)',
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
  'No declared challengers on record here yet. Candidates file October 19-26, 2026; this page fills in as they go public and file.':
    'Aún no hay retadores declarados aquí. La inscripción es del 19 al 26 de octubre de 2026; esta página se llena conforme los candidatos se anuncian e inscriben.',
  'Ward not found.': 'Distrito no encontrado.',

  policy: 'propuesta',
  policies: 'propuestas',

  // Big board
  '{city}’s top concerns, ranked by the people.': 'Las principales preocupaciones de {city}, clasificadas por la gente.',
  'Raise a concern': 'Plantea una preocupación',
  'Sign in to raise a concern': 'Inicia sesión para plantear una preocupación',
  'No citywide concerns yet. Be the first to raise one.': 'Aún no hay preocupaciones de toda la ciudad. Sé la primera persona en plantear una.',
  'Citywide votes': 'Votaciones de toda la ciudad',
  'Questions put to the whole city by elected officials': 'Preguntas que los oficiales electos ponen a toda la ciudad',
  'Verified votes': 'Votos verificados',
  'Every tally counts two ways: all users, and verified users. Verified means an adult Chicago resident of a ward - nothing about party or voter registration. Use the toggle to switch views.':
    'Cada conteo se hace de dos maneras: todos los usuarios y usuarios verificados. Verificado significa un adulto residente de un distrito de Chicago, nada sobre partido ni registro de votante. Usa el selector para cambiar de vista.',
  'Verification is handled by Didit, an independent identity service. Your documents go to Didit, never to us - all we ever receive is a yes/no and your ward.':
    'La verificación la maneja Didit, un servicio independiente de identidad. Tus documentos van a Didit, nunca a nosotros; lo único que recibimos es un sí o no y tu distrito.',

  // Notifications
  'Answers, replies, and credits, as they land.': 'Respuestas, réplicas y créditos, conforme llegan.',
  'Sign in and this is where responses to your questions and comments arrive.': 'Inicia sesión y aquí llegarán las respuestas a tus preguntas y comentarios.',
  'Sign in': 'Iniciar sesión',
  'Nothing yet. Ask a question or join an argument and the responses land here.': 'Aún nada. Haz una pregunta o únete a un debate y las respuestas llegan aquí.',
  'Mark all {n} read': 'Marcar {n} como leídos',
  'Could not update': 'No se pudo actualizar',

  // Profile
  'Sign in to vote on concerns, join ward votes, and hold officials to account.': 'Inicia sesión para votar preocupaciones, unirte a las votaciones de tu distrito y exigir cuentas a los oficiales.',
  'Sign in or create account': 'Inicia sesión o crea una cuenta',
  'Could not update name': 'No se pudo actualizar el nombre',
  'Something went wrong.': 'Algo salió mal.',
  Unverified: 'Sin verificar',
  'Elected official': 'Oficial electo',
  Candidate: 'Candidato',
  'Edit display name': 'Editar nombre visible',
  Shuffle: 'Aleatorio',
  Save: 'Guardar',
  Cancel: 'Cancelar',
  'Display names are whatever you want them to be - your real identity is never shown, even when verified.': 'Tu nombre visible es el que tú quieras; tu identidad real nunca se muestra, ni siquiera al verificarte.',
  'Your public card': 'Tu tarjeta pública',
  'How voters see you - tap to open your page': 'Cómo te ven los votantes; toca para abrir tu página',
  'Civic record': 'Historial cívico',
  Concerns: 'Preocupaciones',
  Comments: 'Comentarios',
  Votes: 'Votos',
  Judgments: 'Juicios',
  'writing credit': 'crédito de autoría',
  'writing credits': 'créditos de autoría',
  'candidates changed a policy because of your comments.': 'candidatos cambiaron una política por tus comentarios.',
  'My activity': 'Mi actividad',
  'Identity verification': 'Verificación de identidad',
  'You’re verified as a resident of the {ward}. Your votes count in the verified tallies.': 'Estás verificado como residente del {ward}. Tus votos cuentan en los conteos verificados.',
  'You’re verified as a Chicago resident. Your votes count in the verified tallies.': 'Estás verificado como residente de Chicago. Tus votos cuentan en los conteos verificados.',
  'Verify once to unlock your ward tab and make your votes count in the verified tallies. A third-party service (Didit) checks your ID. We only ever receive a yes/no and your ward. No documents, no address, nothing else.':
    'Verifícate una vez para desbloquear la pestaña de tu distrito y que tus votos cuenten en los conteos verificados. Un servicio externo (Didit) revisa tu identificación. Solo recibimos un sí o no y tu distrito. Sin documentos, sin dirección, nada más.',
  'Verify my identity': 'Verificar mi identidad',
  'Blocked users': 'Usuarios bloqueados',
  'Their content is hidden for you - unblock any time': 'Su contenido está oculto para ti; desbloquea cuando quieras',
  Unblock: 'Desbloquear',
  'Could not unblock': 'No se pudo desbloquear',
  Settings: 'Ajustes',
  'Sign out': 'Cerrar sesión',
  'Sign out?': '¿Cerrar sesión?',
  'You will need to sign in again to vote, comment, or ask questions.': 'Tendrás que iniciar sesión de nuevo para votar, comentar o hacer preguntas.',
  'Could not sign out': 'No se pudo cerrar la sesión',

  // Wards tab
  'Every ward’s board is public. Pick one to browse.': 'El tablero de cada distrito es público. Elige uno para explorar.',
  'Back to my ward': 'Volver a mi distrito',
  'Verify your residency': 'Verifica tu residencia',
  'Sign in to verify your residency': 'Inicia sesión para verificar tu residencia',
  'Verify to participate in your ward’s board and polls.': 'Verifícate para participar en el tablero y las votaciones de tu distrito.',
  '50 wards, one city': '50 distritos, una ciudad',
  'All wards': 'Todos los distritos',
  'Ward leaderboard': 'Tablero del distrito',
  'Anyone can weigh in. Verified counts are residents of this ward only.': 'Cualquiera puede opinar. Los conteos verificados son solo de residentes de este distrito.',
  'Raise a ward concern': 'Plantea una preocupación del distrito',
  'Sign in to vote and comment': 'Inicia sesión para votar y comentar',
  'Raising a ward concern takes a verified resident of the ward.': 'Plantear una preocupación del distrito requiere ser residente verificado del distrito.',
  'Verify to unlock your home ward': 'Verifícate para desbloquear tu distrito',
  'Anyone can vote and comment here; raising a ward concern takes a verified resident.': 'Cualquiera puede votar y comentar aquí; plantear una preocupación del distrito requiere residencia verificada.',
  'Anyone can vote and comment here; ward posting unlocks once your verification includes your ward.': 'Cualquiera puede votar y comentar aquí; publicar en el distrito se desbloquea cuando tu verificación incluya tu distrito.',
  'Anyone can vote and comment here; you raise ward concerns in your home ward, the {ward}.': 'Cualquiera puede votar y comentar aquí; tus preocupaciones de distrito se plantean en tu propio distrito, el {ward}.',
  'No ward concerns yet. Raise the first one.': 'Aún no hay preocupaciones en este distrito. Plantea la primera.',
  'No concerns in this ward yet.': 'Aún no hay preocupaciones en este distrito.',
  'On the ballot': 'En la boleta',
  'Past votes': 'Votaciones pasadas',

  // Sign in and verify
  'Welcome back': 'Hola de nuevo',
  'Create account': 'Crear cuenta',
  'Sign in to direct democracy': 'Inicia sesión en direct democracy',
  'Get started with direct democracy': 'Empieza con direct democracy',
  'New here?': '¿Primera vez aquí?',
  'Already have an account?': '¿Ya tienes una cuenta?',
  'Create an account': 'Crear una cuenta',
  'Email': 'Correo electrónico',
  'Password': 'Contraseña',
  'At least 6 characters': 'Al menos 6 caracteres',
  'Hide': 'Ocultar',
  'Show': 'Mostrar',
  'Enter': 'Entrar',
  'Email me a sign-in link': 'Envíame un enlace de acceso',
  'Forgot password?': '¿Olvidaste tu contraseña?',
  'or sign in with': 'o inicia sesión con',
  'or sign up with': 'o regístrate con',
  'Sign in with Google': 'Iniciar sesión con Google',
  'Sign in with Apple': 'Iniciar sesión con Apple',
  'By continuing you agree to our': 'Al continuar aceptas nuestra',
  'privacy policy': 'política de privacidad',
  'Signing in with Google…': 'Iniciando sesión con Google…',
  'Signing in with Apple…': 'Iniciando sesión con Apple…',
  'Type your email above first.': 'Primero escribe tu correo arriba.',
  'Link sent': 'Enlace enviado',
  'Check your email on this device. The link signs you in with no password.': 'Revisa tu correo en este dispositivo. El enlace te inicia sesión sin contraseña.',
  'Reset email sent': 'Correo de restablecimiento enviado',
  'Check your inbox for a link to set a new password.': 'Revisa tu bandeja de entrada para el enlace que crea una nueva contraseña.',
  'Email or password is incorrect.': 'Correo o contraseña incorrectos.',
  'An account with that email already exists.': 'Ya existe una cuenta con ese correo.',
  'That email address doesn’t look right.': 'Ese correo electrónico no parece válido.',
  'Choose a stronger password (at least 6 characters).': 'Elige una contraseña más segura (al menos 6 caracteres).',
  'Too many attempts. Try again later.': 'Demasiados intentos. Inténtalo más tarde.',
  'Network problem. Check your connection and try again.': 'Problema de red. Revisa tu conexión e inténtalo de nuevo.',
  'Sign in first': 'Primero inicia sesión',
  'You’re verified': 'Estás verificado',
  'Resident of the {ward}.': 'Residente del {ward}.',
  'Verified Chicago resident.': 'Residente verificado de Chicago.',
  'Verification failed': 'La verificación falló',
  'How verification works': 'Cómo funciona la verificación',
  'You verify your ID and Chicago address with Didit, a third-party identity service. Your documents go to them, never to us.': 'Verificas tu identificación y tu domicilio en Chicago con Didit, un servicio de identidad independiente. Tus documentos van a ellos, nunca a nosotros.',
  'All we ever save: a verified yes/no, the ward you live in, and a unique identifier that stops one person from verifying twice.': 'Lo único que guardamos: un sí/no de verificación, el distrito donde vives y un identificador único que impide que una persona se verifique dos veces.',
  'No name, no address, no document. Your display name stays anonymous, even once verified.': 'Sin nombre, sin domicilio, sin documento. Tu nombre de usuario sigue siendo anónimo, incluso ya verificado.',
  'Start verification with Didit': 'Iniciar la verificación con Didit',

  // Officials directory and AMA
  'ama': 'AMA',
  'Ongoing ask-me-anythings with Chicago’s elected officials, each graded two ways: approval from their constituents, and whether they actually answer questions.': 'AMAs continuos con los oficiales electos de Chicago, cada uno calificado de dos maneras: la aprobación de sus representados y si de verdad responden las preguntas.',
  'No officials on the platform yet.': 'Aún no hay oficiales en la plataforma.',
  'your alderman': 'tu concejal',
  'every ward': 'cada distrito',
  'on the platform': 'en la plataforma',
  'Approval -': 'Aprobación -',
  '{pct}% approval': '{pct}% de aprobación',
  'Answers': 'Respuestas',
  'Answers -': 'Respuestas -',
  'Official not found.': 'Oficial no encontrado.',
  'Almost there': 'Casi listo',
  'Ask a question of at least 10 characters.': 'Haz una pregunta de al menos 5 caracteres.',
  'Could not ask': 'No se pudo preguntar',
  'Do you approve of the job {name} is doing?': '¿Apruebas el trabajo que está haciendo {name}?',
  'Ask anything. The community judges whether the question was answered sufficiently.': 'Pregunta lo que sea. La comunidad juzga si la pregunta fue respondida de verdad.',
  'Ask {name} anything…': 'Pregúntale lo que sea a {name}…',
  'Ask': 'Preguntar',
  'Questions': 'Preguntas',
  'No questions yet. Ask the first one.': 'Aún no hay preguntas. Haz la primera.',
  'OVERALL': 'GENERAL',
  'On the platform - this official answers here': 'En la plataforma - este oficial responde aquí',
  'Not on the platform yet. This profile is public record; {name} can claim it any time, and unanswered questions stay pending until they do.': 'Aún no está en la plataforma. Este perfil es registro público; {name} puede reclamarlo en cualquier momento, y las preguntas sin responder quedan pendientes hasta que lo haga.',
  'Approval': 'Aprobación',
  'how well liked': 'qué tanto lo aprueban',
  'straight answers given': 'respuestas directas dadas',
  'How answers are graded': 'Cómo se califican las respuestas',
  'Every response counts as answered until the community judges it a dodge. Each question is weighted by the verified people who joined it, so ignoring a question fifty people want answered costs far more than ignoring one nobody backed. Unanswered questions get a week of grace before they count as ignored.': 'Cada respuesta cuenta como respondida hasta que la comunidad la juzga como evasiva. Cada pregunta se pondera por las personas verificadas que se le unieron, así que ignorar una pregunta que cincuenta personas quieren respondida cuesta mucho más que ignorar una que nadie respaldó. Las preguntas sin responder tienen una semana de gracia antes de contar como ignoradas.',
  'How {axis} are graded': 'Cómo se califica: {axis}',
  'answered': 'respondidas',
  'dodged': 'esquivadas',
  'ignored': 'ignoradas',
  'pending': 'pendientes',
  'Awaiting response': 'Esperando respuesta',
  'Answered': 'Respondida',
  'Dodged': 'Esquivada',
  'Yes, withdraw': 'Sí, retirarla',
  'Keep it': 'Conservarla',
  'Withdraw my question': 'Retirar mi pregunta',
  'Could not withdraw': 'No se pudo retirar',
  'Your voice was not recorded': 'Tu voz no quedó registrada',
  'Official response': 'Respuesta oficial',
  'Did this answer the question?': '¿Esto respondió la pregunta?',
  'Write your response…': 'Escribe tu respuesta…',
  'Post response': 'Publicar respuesta',
  'Could not respond': 'No se pudo responder',
  'Could not record judgment': 'No se pudo registrar el veredicto',
  'Could not save': 'No se pudo guardar',
  'Edit my card': 'Editar mi tarjeta',
  'Bio': 'Biografía',
  'Portrait link (https)': 'Enlace del retrato (https)',
  'Link a photo hosted on your own site or campaign page - direct democracy displays it but never stores the image.': 'Enlaza una foto alojada en tu propio sitio o página de campaña - direct democracy la muestra pero nunca almacena la imagen.',
  'Question alert threshold': 'Umbral de alerta de preguntas',
  'You\'ll get a notification when a question in your AMA reaches this many upvotes.': 'Recibirás una notificación cuando una pregunta en tu AMA alcance este número de apoyos.',

  // Concerns, polls, and election questions
  'Concern not found.': 'Preocupación no encontrada.',
  'Give your concern a title of at least 4 characters.': 'Dale a tu preocupación un título de al menos 4 caracteres.',
  'Withdraw this concern?': '¿Retirar esta preocupación?',
  'This permanently removes the concern, everyone’s votes on it, and its comments. It cannot be undone.': 'Esto elimina permanentemente la preocupación, los votos de todos sobre ella y sus comentarios. No se puede deshacer.',
  'Withdraw forever': 'Retirar para siempre',
  'Concern withdrawn': 'Preocupación retirada',
  'Your concern and its votes were removed.': 'Tu preocupación y sus votos fueron eliminados.',
  'Could not delete': 'No se pudo eliminar',
  'Vote failed': 'El voto falló',
  'Title': 'Título',
  'What’s going on?': '¿Qué está pasando?',
  'Edit': 'Editar',
  'Yes, withdraw it': 'Sí, retirarla',
  'Withdraw concern': 'Retirar la preocupación',
  'How much does this matter?': '¿Qué tanto importa esto?',
  'Results': 'Resultados',
  'Raise a concern for your neighbors to prioritize. Clear, specific concerns climb the board.': 'Plantea una preocupación para que tus vecinos la prioricen. Las preocupaciones claras y específicas suben en el tablero.',
  'Describe the concern in at least 20 characters.': 'Describe la preocupación en al menos 20 caracteres.',
  'Could not post': 'No se pudo publicar',
  'e.g. Fix the potholes on Western Ave': 'p. ej. Reparar los baches de Western Ave',
  'Describe the issue, where it happens, and who it affects…': 'Describe el problema, dónde ocurre y a quién afecta…',
  'Where does this belong?': '¿A dónde pertenece esto?',
  'Citywide': 'Toda la ciudad',
  'My ward': 'Mi distrito',
  'My ward (verify first)': 'Mi distrito (verifícate primero)',
  'Post concern': 'Publicar preocupación',
  'Only elected officials and candidates can create polls.': 'Solo los oficiales electos y los candidatos pueden crear votaciones.',
  'Write a question of at least 10 characters.': 'Escribe una pregunta de al menos 5 caracteres.',
  'List at least two options, one per line.': 'Enumera al menos dos opciones, una por línea.',
  'Could not create poll': 'No se pudo crear la votación',
  'Question': 'Pregunta',
  'Should the ward…': '¿Debería el distrito…',
  'Context (optional)': 'Contexto (opcional)',
  'Background, tradeoffs, links…': 'Antecedentes, ventajas y desventajas, enlaces…',
  'Vote format': 'Formato de votación',
  'Yes / No': 'Sí / No',
  'A straight up-or-down question': 'Una pregunta directa de sí o no',
  'Multiple choice': 'Opción múltiple',
  'Voters pick one option': 'Los votantes eligen una opción',
  'Voters pick every option they support': 'Los votantes eligen todas las opciones que apoyan',
  '5-point scale': 'Escala de 5 puntos',
  'Strongly oppose → strongly support': 'Muy en contra → muy a favor',
  'Options (one per line)': 'Opciones (una por línea)',
  'Option A\nOption B\nOption C': 'Opción A\nOpción B\nOpción C',
  'Audience': 'Audiencia',
  'verified residents': 'residentes verificados',
  'Citywide (everyone)': 'Toda la ciudad (todos)',
  'Open the vote': 'Abrir la votación',
  'Question not found.': 'Pregunta no encontrada.',
  'Question withdrawn': 'Pregunta retirada',
  'Your question was removed.': 'Tu pregunta fue eliminada.',
  'Asked by {name}': 'Preguntado por {name}',
  'Withdraw question': 'Retirar la pregunta',
  'Every candidate\'s answer, side by side. Your votes set the order; no numbers are shown.': 'La respuesta de cada candidato, lado a lado. Tus votos determinan el orden; no se muestran números.',
  'No candidate has answered yet. Answers appear here the moment they do.': 'Ningún candidato ha respondido todavía. Las respuestas aparecen aquí en cuanto lo hagan.',
  'Answer updated': 'Respuesta actualizada',
  'Answer posted': 'Respuesta publicada',
  'Voters see every answer side by side.': 'Los votantes ven cada respuesta lado a lado.',
  'Could not save your answer': 'No se pudo guardar tu respuesta',
  'Your answer (one per candidate - edits replace it)': 'Tu respuesta (una por candidato - las ediciones la reemplazan)',
  'Your answer': 'Tu respuesta',
  'Answer the city yourself, on the record…': 'Respóndele a la ciudad tú mismo, públicamente…',
  'Update answer': 'Actualizar respuesta',
  'Post answer': 'Publicar respuesta',
  'Answers are part of the public record; revise the text, but it cannot be taken down.': 'Las respuestas son parte del registro público; revisa el texto, pero no se puede retirar.',
  'Could not record your vote': 'No se pudo registrar tu voto',
  'Show less': 'Mostrar menos',
  'Read the rest': 'Leer el resto',
  'This answers it': 'Esto la responde',
  'This dodges it': 'Esto la esquiva',
  'vote': 'voto',
  'votes': 'votos',
  'comment': 'comentario',
  'comments': 'comentarios',
  'answer': 'respuesta',
  'answers': 'respuestas',
  'verdict': 'veredicto',
  'verdicts': 'veredictos',
  'verified vote': 'voto verificado',
  'verified votes': 'votos verificados',
  'verified verdict': 'veredicto verificado',
  'verified verdicts': 'veredictos verificados',

  // My activity and privacy
  'My concerns': 'Mis preocupaciones',
  'Tap one to see votes and comments': 'Toca una para ver votos y comentarios',
  'You haven\'t raised a concern yet.': 'Aún no has planteado una preocupación.',
  'My AMA questions': 'Mis preguntas de AMA',
  'Tap one to see the official\'s page': 'Toca una para ver la página del oficial',
  'You haven\'t asked an official anything yet.': 'Aún no le has preguntado nada a un oficial.',
  'Community reviewing': 'La comunidad está evaluando',
  'direct democracy is built to know as little about you as possible while still keeping the vote honest.': 'direct democracy está hecha para saber lo menos posible de ti sin dejar de mantener el voto honesto.',
  'What we store': 'Qué guardamos',
  'Your email and password hash (for signing in) - never shown to anyone.': 'Tu correo y el hash de tu contraseña (para iniciar sesión) - nunca se muestran a nadie.',
  'A display name you choose. It\'s a pseudonym; your real name is never shown, even after verification.': 'Un nombre de usuario que tú eliges. Es un seudónimo; tu nombre real nunca se muestra, incluso después de verificarte.',
  'Your ballots, comments, questions, and judgments - the content you post.': 'Tus votos, comentarios, preguntas y veredictos - el contenido que publicas.',
  'If you verify: a yes/no verified flag, your ward, and a unique identifier used to block duplicate accounts. Nothing else, and it is deleted with your account.': 'Si te verificas: un indicador sí/no de verificación, tu distrito y un identificador único que bloquea cuentas duplicadas. Nada más, y se elimina con tu cuenta.',
  'Participation counters (votes cast, concerns raised) that power your milestones.': 'Contadores de participación (votos emitidos, preocupaciones planteadas) que impulsan tus logros.',
  'What we never see': 'Qué nunca vemos',
  'Your identity documents. Verification is performed by Didit, a third-party service; documents go to them, and we receive only the verdict.': 'Tus documentos de identidad. La verificación la hace Didit, un servicio independiente; los documentos van a ellos y nosotros recibimos solo el resultado.',
  'Your address. It is used only at the moment you verify, to find your ward, and is never saved.':
    'Tu domicilio. Solo se usa en el momento en que te verificas, para encontrar tu distrito, y nunca se guarda.',
  'If you pay for a verification: which one you bought, when, and the store’s transaction number. Your payment details stay with Apple or Google.':
    'Si pagas una verificación: cuál compraste, cuándo y el número de transacción de la tienda. Tus datos de pago se quedan con Apple o Google.',
  'Who can see what': 'Quién puede ver qué',
  'Your profile is readable only by you. Content you post carries your display name and a verified badge - nothing more.': 'Tu perfil solo lo puedes leer tú. El contenido que publicas lleva tu nombre de usuario y una insignia de verificación - nada más.',
  'Your individual ballots and judgments are readable only by you; everyone else sees only aggregate tallies.': 'Tus votos y veredictos individuales solo los puedes leer tú; los demás ven solo conteos agregados.',
  'Reports you file are visible only to the platform operators.': 'Los reportes que envías son visibles solo para los operadores de la plataforma.',
  'Your controls': 'Tus controles',
  'Change your display name any time.': 'Cambia tu nombre de usuario en cualquier momento.',
  'Retract any vote while voting is open, withdraw your concerns and unanswered questions, delete your comments. Once a poll closes its result is a public record and ballots are final.': 'Retira cualquier voto mientras la votación esté abierta, retira tus preocupaciones y tus preguntas sin responder, elimina tus comentarios. Cuando una votación cierra, su resultado es registro público y los votos son definitivos.',
  'Block any user to hide their content from your account.': 'Bloquea a cualquier usuario para ocultar su contenido de tu cuenta.',
  'Delete your account any time from Settings: your sign-in, profile, verification status, and standing approvals of officials are removed. Anything you posted is re-attributed to [deleted], and votes you cast remain counted in the tallies.': 'Elimina tu cuenta en cualquier momento desde Ajustes: se eliminan tu acceso, tu perfil, tu estado de verificación y tus aprobaciones vigentes de oficiales. Lo que publicaste se reatribuye a [deleted], y los votos que emitiste siguen contados en los conteos.',

  // Candidate platform
  'Campaign website': 'Sitio de campaña',
  'Copy campaign website link': 'Copiar el enlace del sitio de campaña',
  'Add a policy': 'Agregar una propuesta',
  'New poll': 'Nueva votación',
  'the rest of the field': 'el resto de los contendientes',
  'Declared candidates who have published no platform to import': 'Candidatos declarados que no han publicado una plataforma que importar',
  'the more perfect platform': 'la plataforma más perfecta',
  'Every policy, open to your arguments': 'Cada propuesta, abierta a tus argumentos',
  'No policies published yet.': 'Aún no hay propuestas publicadas.',
  'Questions from {name}': 'Preguntas de {name}',
  'Polls this candidate has put to the city': 'Votaciones que este candidato ha puesto a la ciudad',
  'Imported from {host}': 'Importado de {host}',
  'AI summary': 'Resumen de IA',
  'The platform': 'La plataforma',
  'Next to the other candidates': 'Junto a los demás candidatos',
  'Show more': 'Mostrar más',
  'Written by AI on {date} from the policies listed below, with the same prompt for every candidate. It can miss things. The policies are the source.':
    'Escrito por IA el {date} a partir de las propuestas que aparecen abajo, con la misma instrucción para cada candidatura. Puede omitir cosas. Las propuestas son la fuente.',
  'Copy platform source link': 'Copiar el enlace de la fuente de la plataforma',
  'Hidden': 'Oculta',
  'Campaign website (https)': 'Sitio de campaña (https)',
  'Platform synced': 'Plataforma sincronizada',
  '{count} pulled from your site': '{count} traídas de tu sitio',
  ', {n} no longer on it (hidden).': ', {n} ya no están en él (ocultas).',
  'Sync failed': 'La sincronización falló',
  'Your platform syncs from your campaign site (nightly, or right now with the button).': 'Tu plataforma se sincroniza desde tu sitio de campaña (cada noche, o ahora mismo con el botón).',
  'Last synced': 'Última sincronización',
  'Sync from my site': 'Sincronizar desde mi sitio',
  'Policy not found.': 'Propuesta no encontrada.',
  'Declared candidate · no platform published to import': 'Candidato declarado · sin plataforma publicada que importar',
  'From the platform of {name}': 'De la plataforma de {name}',
  'Links': 'Enlaces',
  'Receipts': 'Fuentes',
  'Copy link:': 'Copiar enlace:',
  'Delete this policy?': '¿Eliminar esta propuesta?',
  'This permanently removes the policy, everyone’s votes on it, and its comments. It cannot be undone.': 'Esto elimina permanentemente la propuesta, los votos de todos sobre ella y sus comentarios. No se puede deshacer.',
  'Delete forever': 'Eliminar para siempre',
  'Policy withdrawn': 'Propuesta retirada',
  'The policy and its votes were removed.': 'La propuesta y sus votos fueron eliminados.',
  'Unhide': 'Mostrar de nuevo',
  'Yes, delete': 'Sí, eliminar',
  'Delete': 'Eliminar',
  'Only candidates can edit a platform.': 'Solo los candidatos pueden editar una plataforma.',
  'Give the policy a title of at least 3 characters.': 'Dale a la propuesta un título de al menos 3 caracteres.',
  'Write out the policy - this is the space to make the case.': 'Escribe la propuesta completa - este es el espacio para defenderla.',
  'Source links must be https:// URLs, one per line.': 'Los enlaces de fuentes deben ser URLs https://, uno por línea.',
  'Could not save policy': 'No se pudo guardar la propuesta',
  'One plank of your platform: a clear title, and all the space you need to make the case. Voters weigh in with support or opposition and argue it out in the comments.': 'Un punto de tu plataforma: un título claro y todo el espacio que necesites para defenderla. Los votantes opinan y lo discuten en los comentarios.',
  'No more Lead Pipes': 'No más tuberías de plomo',
  'Section (optional)': 'Sección (opcional)',
  'Health & Home': 'Salud y hogar',
  'The policy': 'La propuesta',
  'What you\'ll do, why it works, and what it costs…': 'Qué harás, por qué funciona y cuánto cuesta…',
  'Receipts - source links (optional, one per line)': 'Fuentes - enlaces (opcional, uno por línea)',
  'This policy was imported from your campaign site. Saving takes it over: it becomes yours to manage here, its votes and comments stay, and the site no longer updates it.': 'Esta propuesta fue importada de tu sitio de campaña. Guardarla la toma: pasa a administrarse aquí, sus votos y comentarios se conservan, y el sitio ya no la actualiza.',
  'Save changes': 'Guardar cambios',
  'Publish policy': 'Publicar propuesta',

  // Comments and references
  'Newest': 'Recientes',
  'Best': 'Mejores',
  'Comment failed': 'El comentario falló',
  'Replying to {name}': 'Respondiendo a {name}',
  'Cancel reply': 'Cancelar respuesta',
  'Answer {name}…': 'Respóndele a {name}…',
  'Add to the discussion…': 'Súmate a la discusión…',
  'Sources': 'Fuentes',
  'Add a source link': 'Agregar un enlace de fuente',
  'Add another source': 'Agregar otra fuente',
  'Type *1 in your comment to cite source 1 - readers tap it to open the link.': 'Escribe *1 en tu comentario para citar la fuente 1 - los lectores la tocan para abrir el enlace.',
  'Post reply': 'Publicar respuesta',
  'Post comment': 'Publicar comentario',
  'More options': 'Más opciones',
  'Sign in to comment': 'Inicia sesión para comentar',
  'No comments yet.': 'Aún no hay comentarios.',
  'Comment removed': 'Comentario eliminado',
  'replying to {name}': 'respondiendo a {name}',
  'Could not update credit': 'No se pudo actualizar el crédito',
  'Could not delete comment': 'No se pudo eliminar el comentario',
  'Yes, remove': 'Sí, eliminar',
  'Keep': 'Conservar',
  'Remove': 'Eliminar',
  'Retract credit': 'Retirar el crédito',
  'Credit': 'Acreditar',
  'Reply': 'Responder',
  'Rate up': 'Calificar positivo',
  'Rate down': 'Calificar negativo',
  'References': 'Referencias',
  'Add a reference link': 'Agregar un enlace de referencia',
  'Add another reference': 'Agregar otra referencia',
  'Type *1 in your text to cite reference 1 - readers tap it to open the link. Uncited references still show under your concern.': 'Escribe *1 en tu texto para citar la referencia 1 - los lectores la tocan para abrir el enlace. Las referencias sin citar igual aparecen bajo tu preocupación.',
  'Remove reference {n}': 'Eliminar la referencia {n}',
  'source': 'fuente',
  'sources': 'fuentes',
  'Source': 'Fuente',
  'Close': 'Cerrar',

  // Poll and tally components
  'Yes': 'Sí',
  'No': 'No',
  'Strongly oppose': 'Muy en contra',
  'Oppose': 'En contra',
  'Neutral': 'Neutral',
  'Support': 'A favor',
  'Strongly support': 'Muy a favor',
  'Pick one': 'Elige una',
  'Pick all you support': 'Elige todas las que apoyes',
  'How strongly do you feel?': '¿Qué tan de acuerdo estás?',
  'Closed': 'Cerrada',
  'You voted - tap an option below to change it.': 'Ya votaste - toca una opción abajo para cambiarlo.',
  'Update votes': 'Actualizar votos',
  'Cast votes': 'Emitir votos',
  'Close voting': 'Cerrar la votación',
  'Could not close poll': 'No se pudo cerrar la votación',
  'Only residents of this ward can vote on this poll.': 'Solo los residentes de este distrito pueden votar en esta votación.',
  'Verify your identity to vote on ward polls.': 'Verifica tu identidad para votar en las votaciones de distrito.',
  'Sign in to vote': 'Inicia sesión para votar',
  'verified': 'verificado',

  // Approval, claims, school board
  'Could not record approval': 'No se pudo registrar la aprobación',
  'Approve': 'Aprobar',
  'Disapprove': 'Desaprobar',
  'Approval votes are for verified residents - verify to grade your officials': 'Los votos de aprobación son para residentes verificados - verifícate para calificar a tus oficiales',
  'Constituents': 'Representados',
  '{n} of {min} verified ward votes needed': '{n} de {min} votos verificados del distrito necesarios',
  'verified ward vote': 'voto verificado del distrito',
  'verified ward votes': 'votos verificados del distrito',
  'approve': 'de aprobación',
  'Could not send': 'No se pudo enviar',
  'Not confirmed yet': 'Aún no confirmado',
  'Open the confirmation email first, then tap this again.': 'Primero abre el correo de confirmación y luego toca esto de nuevo.',
  'Confirm your email to act as {name}': 'Confirma tu correo para actuar como {name}',
  'Until the address is confirmed, this account can read but not respond, post, or edit. The confirmation proves the inbox is really yours.': 'Hasta que la dirección esté confirmada, esta cuenta puede leer pero no responder, publicar ni editar. La confirmación demuestra que la bandeja de entrada es realmente tuya.',
  'Sent - check your inbox': 'Enviado - revisa tu bandeja de entrada',
  'Send confirmation email': 'Enviar correo de confirmación',
  'I confirmed it': 'Ya lo confirmé',
  'Every Chicagoan votes in this race': 'Todos en Chicago votan en esta carrera',
  'One seat, voted on by district residents': 'Un escaño, votado por los residentes del distrito',

  // Moderation, sorting, update nudge
  'Report sent': 'Reporte enviado',
  'Thank you - the operators will review it.': 'Gracias - los operadores lo revisarán.',
  'Could not send report': 'No se pudo enviar el reporte',
  'Blocked {name}': 'Bloqueaste a {name}',
  'Their content is hidden for you. Manage blocked users from your profile.': 'Su contenido queda oculto para ti. Administra los usuarios bloqueados desde tu perfil.',
  'Could not block': 'No se pudo bloquear',
  'Report this {type}': 'Reportar: {type}',
  'concern': 'preocupación',
  'question': 'pregunta',
  'response': 'respuesta',
  'Spam': 'Spam',
  'Harassment or abuse': 'Acoso o abuso',
  'Misleading or fraudulent': 'Engañoso o fraudulento',
  'Child safety': 'Seguridad infantil',
  'Something else': 'Otra cosa',
  'Block {name}': 'Bloquear a {name}',
  'Highest rated': 'Mejor calificadas',
  'Leave this question': 'Dejar esta pregunta',
  'Join this question, I want it answered too': 'Unirme a esta pregunta, yo también quiero que la respondan',
  'Update': 'Actualizar',
  'Time for an update': 'Es hora de actualizar',
  'A fresh update is here': 'Hay una actualización nueva',
  'This version is too old to keep up anymore. Please grab the update from the store. Thank you!': 'Esta versión ya es muy antigua para seguir el paso. Por favor descarga la actualización en la tienda. ¡Gracias!',
  "We've been busy making direct democracy better. Would you mind grabbing the update? Thank you!": 'Hemos estado trabajando para mejorar direct democracy. ¿Nos haces el favor de descargar la actualización? ¡Gracias!',
  'Maybe later': 'Más tarde',

  // Milestones, lenses, misc components
  'First concern raised!': '¡Primera preocupación planteada!',
  '{n} concerns raised!': '¡{n} preocupaciones planteadas!',
  'First vote cast!': '¡Primer voto emitido!',
  '{n} votes cast!': '¡{n} votos emitidos!',
  'First answer judged!': '¡Primera respuesta juzgada!',
  '{n} answers judged!': '¡{n} respuestas juzgadas!',
  'Welcome to direct democracy': 'Te damos la bienvenida a direct democracy',
  'ask them anything': 'pregúntale lo que sea',
  'Copy link': 'Copiar enlace',
  'All users': 'Todos los usuarios',
  'Verified': 'Verificado',

  // Screen titles
  'Concern': 'Preocupación',
  'Official': 'Oficial',
  'Officials': 'Oficiales',
  'Policy': 'Propuesta',
  'Election AMA': 'AMA electoral',
  'School board': 'Consejo escolar',
  'On your ballot': 'En tu boleta',
  'Ward race': 'Carrera del distrito',
  'Platform policy': 'Propuesta de plataforma',
  'Verify identity': 'Verificar identidad',

  // Ward map
  'Zoom in': 'Acercar',
  'Zoom out': 'Alejar',
  'Reset zoom': 'Restablecer el zoom',

  // Account deletion
  'Delete account': 'Eliminar cuenta',
  'Permanently removes your sign-in, profile, verification status, and standing approvals of officials. Anything you posted stays on the record but is re-attributed to [deleted], and votes you cast remain counted. This cannot be undone.': 'Elimina permanentemente tu acceso, tu perfil, tu estado de verificación y tus aprobaciones vigentes de oficiales. Lo que publicaste queda en el registro pero se reatribuye a [deleted], y los votos que emitiste siguen contados. No se puede deshacer.',
  'Yes, delete forever': 'Sí, eliminar para siempre',
  'Delete your account?': '¿Eliminar tu cuenta?',
  'This permanently removes your sign-in, profile, verification, and standing approvals. Posts stay on the record as [deleted] and cast ballots remain counted. It cannot be undone.': 'Esto elimina permanentemente tu acceso, tu perfil, tu verificación y tus aprobaciones vigentes. Las publicaciones quedan en el registro como [deleted] y los votos emitidos siguen contados. No se puede deshacer.',
  'Account deleted': 'Cuenta eliminada',
  'Your account and identity data are gone.': 'Tu cuenta y tus datos de identidad fueron eliminados.',
  'Could not delete account': 'No se pudo eliminar la cuenta',
  'Keep my account': 'Conservar mi cuenta',
  'Delete my account…': 'Eliminar mi cuenta…',

  // Candidate offices (operator-provisioned account data)
  'Candidate for Mayor': 'Candidato a la alcaldía',

  // Party labels
  'Republican': 'Republicano',
  'Democratic': 'Demócrata',
  'Independent': 'Independiente',
  'Libertarian': 'Libertario',

  // Court names
  'Circuit Court of Cook County': 'Corte de Circuito del Condado de Cook',
  'Illinois Appellate Court, First District': 'Corte de Apelaciones de Illinois, Primer Distrito',

  // Settings
  Language: 'Idioma',
  'Privacy & data': 'Privacidad y datos',
  Verification: 'Verificación',
  'Verify a new address': 'Verificar una nueva dirección',
  'Moved within Chicago? Verify your new address and your ward moves with you. If your ID shows the new address, your ID is enough. If it doesn’t, add a utility bill or bank statement from the last 3 months. You can do this once every 3 months.':
    '¿Te mudaste dentro de Chicago? Verifica tu nueva dirección y tu distrito se muda contigo. Si tu identificación muestra la nueva dirección, basta con tu identificación. Si no, agrega un recibo de servicios o un estado de cuenta bancario de los últimos 3 meses. Puedes hacerlo una vez cada 3 meses.',
  'Verify with my ID': 'Verificar con mi identificación',
  'Join your ward': 'Únete a tu distrito',
  'Sign in to join your ward': 'Inicia sesión para unirte a tu distrito',
  'Raise concerns, vote on ward polls, and rate your alderman.':
    'Plantea preocupaciones, vota en las votaciones del distrito y califica a tu concejal.',
  'Verified residents also count in the verified tallies.':
    'Los residentes verificados también cuentan en los conteos verificados.',
  'Take part in your ward: verify your residency with your ID, or set your home ward without one.':
    'Participa en tu distrito: verifica tu residencia con tu identificación, o fija tu distrito sin ella.',
  'Your home ward is the {ward}, set without verification. Verify your residency to make your votes count in the verified tallies; verifying places you in the ward on your ID.':
    'Tu distrito es el {ward}, fijado sin verificación. Verifica tu residencia para que tus votos cuenten en los conteos verificados; al verificarte, quedas en el distrito que aparece en tu identificación.',
  'Your home ward is the {ward}.': 'Tu distrito es el {ward}.',
  Next: 'Siguiente',
  'Home ward set': 'Distrito fijado',
  'You’re in the {ward}.': 'Estás en el {ward}.',
  'Could not set your home ward': 'No pudimos fijar tu distrito',
  'Pick your home ward': 'Elige tu distrito',
  'Not sure of your ward? Look up your address': '¿No sabes tu distrito? Busca tu dirección',
  'Set home ward': 'Fijar distrito',
  'My ward (set your ward first)': 'Mi distrito (fija tu distrito primero)',
  'Rating officials takes a home ward.': 'Calificar a los oficiales requiere tener un distrito.',
  'Ward polls are for residents of the ward.': 'Las votaciones del distrito son para residentes del distrito.',
  'Set your home ward': 'Fija tu distrito',
  'No ID needed to set a home ward. Verified residents also count in the verified tallies.':
    'No necesitas identificación para fijar tu distrito. Los residentes verificados también cuentan en los conteos verificados.',
  'Pay {price} and start': 'Pagar {price} y empezar',
  'Payment failed': 'El pago falló',
  'This month’s free verifications just ran out': 'Las verificaciones gratis de este mes se acaban de agotar',
  'The price is on the button now.': 'El precio ya aparece en el botón.',
  'Couldn’t load the price. Check your connection and try again.':
    'No pudimos cargar el precio. Revisa tu conexión e intenta de nuevo.',
  'Already paid. This attempt is covered.': 'Ya pagaste. Este intento está cubierto.',
  'Paying for verification works in the iPhone and Android apps.':
    'El pago de la verificación funciona en las apps de iPhone y Android.',
  'Getting the price…': 'Obteniendo el precio…',
  'Checking a bill or statement costs {price}.': 'Revisar un recibo o estado de cuenta cuesta {price}.',
  'The first 500 verifications each month are free. This month’s are used up, so this one costs {price}.':
    'Las primeras 500 verificaciones de cada mes son gratis. Las de este mes ya se usaron, así que esta cuesta {price}.',
  'If you don’t open the verification link, your payment carries over to your next attempt.':
    'Si no abres el enlace de verificación, tu pago se guarda para tu próximo intento.',
  'Verify with a bill or statement': 'Verificar con un recibo o estado de cuenta',
  'Have your ID and a utility bill or bank statement from the last 3 months showing your name and your new Chicago address. If it’s in a different ward, your ward moves there. If we can’t place it in Chicago, nothing changes. You can do this once every 3 months.':
    'Ten a la mano tu identificación y un recibo de servicios o estado de cuenta bancario de los últimos 3 meses con tu nombre y tu nueva dirección en Chicago. Si está en otro distrito, tu distrito se cambia a ese. Si no podemos ubicarla en Chicago, nada cambia. Puedes hacerlo una vez cada 3 meses.',
  'You can verify a new address again on {date}.':
    'Puedes verificar una nueva dirección de nuevo el {date}.',
  'Use an ID that shows your new Chicago address. If it’s in a different ward, your ward moves there. If we can’t place it in Chicago, nothing changes. You can do this once every 3 months.':
    'Usa una identificación que muestre tu nueva dirección en Chicago. Si está en otro distrito, tu distrito se cambia a ese. Si no podemos ubicarla en Chicago, nada cambia. Puedes hacerlo una vez cada 3 meses.',
  'Verified only':
    'Solo verificados',
  'Switches to {option}':
    'Cambia a {option}',
  'You can post up to 3 times a day in your home ward. You can post again {date}.':
    'Puedes publicar hasta 3 veces al día en tu distrito. Puedes volver a publicar el {date}.',
  'You can post in a ward that isn’t yours once a week. You can post in the {ward} again {date}.':
    'En un distrito que no es el tuyo puedes publicar una vez por semana. Puedes volver a publicar en el {ward} el {date}.',
  'The {ward} isn’t your home ward, so you can post here once a week.':
    'El {ward} no es tu distrito, así que aquí puedes publicar una vez por semana.',
  'This isn’t your home ward, so you can post here once a week.':
    'Este no es tu distrito, así que aquí puedes publicar una vez por semana.',
  'Raise a concern in this ward':
    'Plantear una preocupación en este distrito',
  'Anyone can post here once a week. With a home ward you can post there up to 3 times a day, vote on its polls, and rate its alderman.':
    'Cualquiera puede publicar aquí una vez por semana. Con un distrito propio puedes publicar allí hasta 3 veces al día, votar en sus votaciones y calificar a su concejal.',
  'You’ve posted there, so it stays until {date}. Verifying your residency changes it sooner: it places you in the ward on your ID.':
    'Ya publicaste allí, así que se mantiene hasta el {date}. Verificar tu residencia lo cambia antes: quedas en el distrito que aparece en tu identificación.',
  'How your home ward works':
    'Cómo funciona tu distrito',
  'You can change it until you post there, up to 5 times a day.':
    'Puedes cambiarlo hasta que publiques allí, hasta 5 veces al día.',
  'Two posts there (concerns or questions to your alderman) lock it for a week. A third locks it for 3 months.':
    'Dos publicaciones allí (preocupaciones o preguntas a tu concejal) lo bloquean por una semana. Una tercera lo bloquea por 3 meses.',
  'In your home ward you can post up to 3 times a day, vote on ward polls, and rate your alderman. Your votes count with everyone’s, not in the verified tally.':
    'En tu distrito puedes publicar hasta 3 veces al día, votar en las votaciones del distrito y calificar a tu concejal. Tus votos cuentan con los de todos, no en el conteo verificado.',
  'In any other ward you can post once a week.':
    'En cualquier otro distrito puedes publicar una vez por semana.',
  'Verifying your residency checks your ID with Didit and places you in the ward on it, replacing the one you set here.':
    'Al verificar tu residencia, Didit revisa tu identificación y quedas en el distrito que aparece en ella, en lugar del que fijes aquí.',
  'Change home ward':
    'Cambiar de distrito',
  'You’ve posted in your home ward, so you can change it on {date}.':
    'Ya publicaste en tu distrito, así que puedes cambiarlo el {date}.',
  'command center':
    'centro de mando',
  'Citywide issues':
    'Problemas de toda la ciudad',
  'Closed polls':
    'Votaciones cerradas',
  'Election questions you haven’t answered, most joined first. Voters see every candidate’s answer side by side.':
    'Preguntas electorales que aún no respondes, primero las que más gente apoya. Los votantes ven la respuesta de cada candidato lado a lado.',
  'Hidden: this policy is off your public platform. Its comments are kept.':
    'Oculta: esta propuesta no aparece en tu plataforma pública. Sus comentarios se conservan.',
  'Hiding takes this policy off your public platform and keeps its comments. Deleting removes it and its comments for good.':
    'Ocultarla la quita de tu plataforma pública y conserva sus comentarios. Eliminarla la borra junto con sus comentarios para siempre.',
  'Imported':
    'Importada',
  'Joined by {n}':
    'Apoyada por {n}',
  'Most joined first. A question left a week without a response counts as ignored in your grade.':
    'Primero las que más gente apoya. Una pregunta sin respuesta durante una semana cuenta como ignorada en tu calificación.',
  'New citywide poll':
    'Nueva votación para la ciudad',
  'New ward poll':
    'Nueva votación del distrito',
  'No concerns raised here yet.':
    'Todavía no hay preocupaciones aquí.',
  'No questions are waiting on you.':
    'No tienes preguntas pendientes.',
  'Not on the platform yet. We take the top-rated questions here to {name}’s ward office, so {name} can answer without joining the app.':
    'Aún no está en la plataforma. Llevamos las preguntas mejor valoradas de aquí a la oficina de distrito de {name}, para que {name} pueda responder sin unirse a la app.',
  'Polls':
    'Votaciones',
  'Priority {n}':
    'Prioridad {n}',
  'Put a question to the public. Everyone votes; verified residents are counted apart.':
    'Hazle una pregunta al público. Todos votan; los residentes verificados se cuentan aparte.',
  'Questions to answer':
    'Preguntas por responder',
  'Ranked by verified residents. The ones you’ve commented on fold down.':
    'Ordenadas por los residentes verificados. Las que ya comentaste se contraen.',
  'Showing the top {n}.':
    'Se muestran las {n} principales.',
  'The command center is for elected officials and candidates.':
    'El centro de mando es para oficiales electos y candidatos.',
  'View your public page':
    'Ver tu página pública',
  'You can post in up to 5 wards besides your home ward in a week. You can post in another ward again {date}.':
    'En una semana puedes publicar en hasta 5 distritos además del tuyo. Puedes volver a publicar en otro distrito el {date}.',
  'You commented':
    'Comentaste',
  'Your card':
    'Tu tarjeta',
  'Your platform':
    'Tu plataforma',
  'Your polls will appear here.':
    'Tus votaciones aparecerán aquí.',
  'You’ve answered every election question.':
    'Ya respondiste todas las preguntas electorales.',
  '{ward} issues':
    'Problemas del {ward}',
  '{votes} so far. Vote to see the results.':
    '{votes} hasta ahora. Vota para ver los resultados.',
  'This verification is no longer free':
    'Esta verificación ya no es gratis',
  'Your verification is still open. Continue where you left off.':
    'Tu verificación sigue abierta. Continúa donde la dejaste.',
  'Each account gets 3 free verification attempts every 3 months. This account has used them, so this one costs {price}.':
    'Cada cuenta tiene 3 intentos de verificación gratis cada 3 meses. Esta cuenta ya los usó, así que este cuesta {price}.',
  'You can ask citywide officials up to 3 questions a day. You can ask again {date}.':
    'Puedes hacer hasta 3 preguntas al día a oficiales de toda la ciudad. Puedes volver a preguntar el {date}.',
  'You can ask up to 3 election questions a day. You can ask again {date}.':
    'Puedes hacer hasta 3 preguntas electorales al día. Puedes volver a preguntar el {date}.',
  'You can change your home ward up to 5 times a day. Try again tomorrow.':
    'Puedes cambiar tu distrito hasta 5 veces al día. Vuelve a intentarlo mañana.',
  'You can raise up to 2 citywide concerns a day. You can raise another {date}.':
    'Puedes plantear hasta 2 preocupaciones de toda la ciudad al día. Puedes plantear otra el {date}.',
  'Confirm your email first':
    'Confirma tu correo primero',
  'Open the confirmation email, then tap I confirmed it.':
    'Abre el correo de confirmación y luego toca Ya lo confirmé.',
  'A lot of people are verifying today, so free verification needs a confirmed email ({email}). Accounts signed in with Google or Apple skip this.':
    'Mucha gente se está verificando hoy, así que la verificación gratis requiere un correo confirmado ({email}). Las cuentas que entran con Google o Apple no necesitan este paso.',
  'Display name must be at least 3 characters.':
    'El nombre visible debe tener al menos 3 caracteres.',
  'Display name must be {max} characters or fewer.':
    'El nombre visible debe tener {max} caracteres o menos.',
  'Display names can’t start with “Ald.” or “Alderman”.':
    'Los nombres visibles no pueden empezar con “Ald.” ni “Alderman”.',
  'Continue your verification':
    'Continuar tu verificación',
  'A poll needs at least two options.':
    'Una votación necesita al menos dos opciones.',
  'Apple sign-in is available on iOS and the web.':
    'El inicio de sesión con Apple está disponible en iOS y en la web.',
  'Apple sign-in was cancelled.':
    'Se canceló el inicio de sesión con Apple.',
  'At most {n} references per concern.':
    'Como máximo {n} referencias por preocupación.',
  'Confirm your email address first. Open the confirmation email, then try again.':
    'Confirma tu correo primero. Abre el correo de confirmación y vuelve a intentarlo.',
  'Could not confirm the purchase with the store. Try again shortly.':
    'No pudimos confirmar la compra con la tienda. Inténtalo de nuevo en un momento.',
  'Could not read the campaign site. Try again shortly.':
    'No pudimos leer el sitio de la campaña. Inténtalo de nuevo en un momento.',
  'Could not start verification. Try again shortly.':
    'No pudimos iniciar la verificación. Inténtalo de nuevo en un momento.',
  'Google sign-in was cancelled.':
    'Se canceló el inicio de sesión con Google.',
  'Identity verification is not configured yet.':
    'La verificación de identidad todavía no está configurada.',
  'Invalid option.':
    'Opción no válida.',
  'Invalid priority.':
    'Prioridad no válida.',
  'Invalid stance.':
    'Postura no válida.',
  'Missing purchase details.':
    'Faltan los datos de la compra.',
  'No campaign site is linked to this candidate profile.':
    'Este perfil de candidato no tiene un sitio de campaña vinculado.',
  'No profile.':
    'No hay perfil.',
  'Official accounts keep the ward they were set up with.':
    'Las cuentas de oficiales conservan el distrito con el que se crearon.',
  'Official and candidate accounts are removed by the platform operator.':
    'Las cuentas de oficiales y candidatos las elimina el operador de la plataforma.',
  'Official and candidate accounts keep the ward they were set up with.':
    'Las cuentas de oficiales y candidatos conservan el distrito con el que se crearon.',
  'Only candidates can add policies.':
    'Solo los candidatos pueden agregar propuestas.',
  'Only candidates can answer here.':
    'Solo los candidatos pueden responder aquí.',
  'Only candidates can edit a candidate card.':
    'Solo los candidatos pueden editar una tarjeta de candidato.',
  'Only officials and candidates can create polls.':
    'Solo los oficiales y candidatos pueden crear votaciones.',
  'Only the asker can withdraw a question.':
    'Solo quien hizo la pregunta puede retirarla.',
  'Only the author can delete a comment.':
    'Solo el autor puede eliminar un comentario.',
  'Only the author can delete a concern.':
    'Solo el autor puede eliminar una preocupación.',
  'Only the author can edit a concern.':
    'Solo el autor puede editar una preocupación.',
  'Only the candidate can award writing credits on their platform.':
    'Solo el candidato puede otorgar créditos de redacción en su plataforma.',
  'Only the candidate can delete a policy.':
    'Solo el candidato puede eliminar una propuesta.',
  'Only the candidate can edit a policy.':
    'Solo el candidato puede editar una propuesta.',
  'Only the poll author can close it.':
    'Solo el autor de la votación puede cerrarla.',
  'Photo link must be an https:// URL.':
    'El enlace de la foto debe ser una URL https://.',
  'Pick the ward this concern belongs to.':
    'Elige el distrito al que pertenece esta preocupación.',
  'Questions with answers are part of the public record.':
    'Las preguntas con respuestas son parte del registro público.',
  'Reference {n} is blank - fill it in or remove it.':
    'La referencia {n} está vacía: llénala o quítala.',
  'Reference {n} is too long (500 characters max).':
    'La referencia {n} es demasiado larga (máximo 500 caracteres).',
  'Reference {n} must be an https:// link.':
    'La referencia {n} debe ser un enlace https://.',
  'Select at least one option.':
    'Selecciona al menos una opción.',
  'Sign in first.':
    'Inicia sesión primero.',
  'This policy still syncs from the campaign site - edit it first to take it over.':
    'Esta propuesta todavía se sincroniza desde el sitio de la campaña: edítala primero para hacerla tuya.',
  'This poll is closed.':
    'Esta votación está cerrada.',
  'This poll is for residents of its ward.':
    'Esta votación es para residentes de su distrito.',
  'This purchase was already used by another account.':
    'Esta compra ya la usó otra cuenta.',
  'Unknown store.':
    'Tienda desconocida.',
  'Verification needs a payment first. Update the app to pay for it.':
    'La verificación requiere un pago primero. Actualiza la app para pagarla.',
  'Verified accounts use the ward on their ID.':
    'Las cuentas verificadas usan el distrito de su identificación.',
  'Verifying with a bill or statement is not set up yet.':
    'La verificación con un recibo o estado de cuenta todavía no está configurada.',
  'Website link must be an https:// URL.':
    'El enlace del sitio web debe ser una URL https://.',
  'You can verify a new address once every 3 months.':
    'Puedes verificar una nueva dirección una vez cada 3 meses.',
  'You cannot block yourself.':
    'No puedes bloquearte a ti mismo.',
  'You cannot credit your own comment.':
    'No puedes darle crédito a tu propio comentario.',
  'You have changed your home ward 5 times today. Try again tomorrow.':
    'Ya cambiaste tu distrito 5 veces hoy. Vuelve a intentarlo mañana.',
  'You have posted in your home ward, so it is locked for now. Verify your residency to change it sooner.':
    'Ya publicaste en tu distrito, así que por ahora está bloqueado. Verifica tu residencia para cambiarlo antes.',
  'Your verification is already starting. Give it a moment.':
    'Tu verificación ya está empezando. Espera un momento.',
  'Sign-in link failed':
    'Falló el enlace para iniciar sesión',
  'Signed in, but your account data could not be loaded':
    'Iniciaste sesión, pero no pudimos cargar los datos de tu cuenta',
  'Could not post the question':
    'No se pudo publicar la pregunta',
  'The question alert threshold must be a whole number from 1 to 10,000.':
    'El umbral de alerta de preguntas debe ser un número entero del 1 al 10,000.',
  'Put a question directly to your constituents. Ward polls take votes from people whose home ward is yours, with verified residents counted apart; citywide polls are open to everyone, with verified results alongside.':
    'Hazle una pregunta directamente a tus electores. Las votaciones del distrito reciben votos de quienes tienen tu distrito como propio, con los residentes verificados contados aparte; las votaciones de toda la ciudad están abiertas a todos, con los resultados verificados al lado.',
  'residents':
    'residentes',
  'Open votes from your alderman, for residents of the ward. Verified residents are counted apart.':
    'Votaciones abiertas de tu concejal, para residentes del distrito. Los residentes verificados se cuentan aparte.',
  'Hide edit history':
    'Ocultar el historial de ediciones',
  'Edited · See edit history':
    'Editado · Ver el historial de ediciones',
  'Before the edit on {date}:':
    'Antes de la edición del {date}:',
  'Edited {date}':
    'Editado el {date}',
  'Most joined first. A question left a week without a response counts as ignored in your grade, and questions from verified residents count double.':
    'Primero las que más gente apoya. Una pregunta sin respuesta durante una semana cuenta como ignorada en tu calificación, y las preguntas de residentes verificados cuentan doble.',
  '{n} verified residents':
    '{n} residentes verificados',
  'Verified resident':
    'Residente verificado',
  'Your official profile isn’t set up yet.':
    'Tu perfil de oficial aún no está configurado.',
  'Your candidate profile isn’t set up yet.':
    'Tu perfil de candidato aún no está configurado.',
  'From “ask every candidate”, most joined first. Voters see every candidate’s answer side by side.':
    'De “pregúntales a todos los candidatos”, primero las que más gente apoya. Los votantes ven la respuesta de cada candidato lado a lado.',
  'No one has asked the candidates a question yet.':
    'Nadie les ha hecho una pregunta a los candidatos todavía.',
  'You answered':
    'Respondiste',
  'Comments on your policies':
    'Comentarios en tus propuestas',
  'Newest first.':
    'Primero los más recientes.',
  'No comments on your policies yet.':
    'Todavía no hay comentarios en tus propuestas.',
  'This can’t be edited.':
    'Esto no se puede editar.',
  'Write something first.':
    'Escribe algo primero.',
  'At most 10 references.':
    'Como máximo 10 referencias.',
  'References must be https:// links.':
    'Las referencias deben ser enlaces https://.',
  'That post is gone.':
    'Esa publicación ya no existe.',
  'Only the author can edit this.':
    'Solo el autor puede editar esto.',
  'An answered question can’t be edited.':
    'Una pregunta ya respondida no se puede editar.',
  'Too many edits for now. Try again in a while.':
    'Demasiadas ediciones por ahora. Vuelve a intentarlo en un rato.',
  'Also a city service problem? Report it to 311':
    '¿También es un problema de servicio de la ciudad? Repórtalo al 311',
  'More help voting':
    'Más ayuda para votar',
  'Voting with a disability: an accessible mail ballot you mark online and print, curbside voting (request it by 5 pm the day before election day), and help at 312-269-7976.':
    'Votar con una discapacidad: una boleta por correo accesible que marcas en línea e imprimes, votación en la acera (pídela antes de las 5 pm del día anterior a la elección) y ayuda al 312-269-7976.',
  'Help in your language: every voting machine has ballots in 12 languages, many sites have bilingual officials, and you may bring someone to interpret.':
    'Ayuda en tu idioma: cada máquina de votación tiene boletas en 12 idiomas, muchos sitios tienen funcionarios bilingües y puedes llevar a alguien que te interprete.',
  'Get a mail ballot for every future election by joining the permanent vote by mail roster.':
    'Recibe una boleta por correo para cada elección futura inscribiéndote en la lista permanente de voto por correo.',
  'Under 18? You can pre-register online at 16.':
    '¿Tienes menos de 18? Puedes preinscribirte en línea desde los 16.',
  'Work the polls: election judges are paid $170 to $230 for the day. High school juniors and seniors can serve too.':
    'Trabaja en las urnas: los jueces electorales reciben de $170 a $230 por el día. Los estudiantes de los dos últimos años de preparatoria también pueden participar.',
  'Show more ({n} left)':
    'Mostrar más (quedan {n})',
  'Conversation ({n})':
    'Conversación ({n})',
  'Continue the conversation':
    'Continuar la conversación',
  'official':
    'oficial',
  'Phone notifications':
    'Notificaciones en el teléfono',
  'Phone notifications work in the iPhone and Android apps.':
    'Las notificaciones en el teléfono funcionan en las apps de iPhone y Android.',
  'Phone notifications need a real phone':
    'Las notificaciones necesitan un teléfono real',
  'They work in the iPhone and Android apps on a phone, not in a simulator or on the web.':
    'Funcionan en las apps de iPhone y Android en un teléfono, no en un simulador ni en la web.',
  'Your phone has notifications turned off for this app. Turn them on in your phone’s settings.':
    'Tu teléfono tiene las notificaciones desactivadas para esta app. Actívalas en la configuración de tu teléfono.',
  'Open phone settings':
    'Abrir la configuración del teléfono',
  'Election reminders':
    'Recordatorios de elecciones',
  'A politician answered your question':
    'Un político respondió tu pregunta',
  'Comments on your posts':
    'Comentarios en tus publicaciones',
  'Replies to your comments':
    'Respuestas a tus comentarios',
  'Writing credits on your comments':
    'Créditos de redacción en tus comentarios',
  'New questions for you':
    'Nuevas preguntas para ti',
  'City Council':
    'Concejo Municipal',
  'What the Council is deciding, and when you can speak up.':
    'Lo que el Concejo está decidiendo y cuándo puedes opinar.',
  'Coming up':
    'Próximamente',
  'How to give public comment':
    'Cómo hacer un comentario público',
  'Recent split votes':
    'Votaciones divididas recientes',
  'All Council legislation':
    'Toda la legislación del Concejo',
  'City Council meeting':
    'Sesión del Concejo Municipal',
  'Public comment deadline: {date}':
    'Fecha límite para comentarios públicos: {date}',
  'Agenda':
    'Agenda',
  'Meeting notice':
    'Aviso de la reunión',
  'Voting record':
    'Historial de votos',
  'Votes where the Council split, and every vote where this alderman was on the losing side. From the City Clerk.':
    'Votaciones en las que el Concejo se dividió y cada votación en la que este concejal quedó del lado perdedor. Del Secretario Municipal.',
  'Voted yes':
    'Votó sí',
  'Voted no':
    'Votó no',
  'Absent':
    'Ausente',
  'Not Voting':
    'No votó',
  'Present':
    'Presente',
  'Recused':
    'Se abstuvo por conflicto',
  'Report or block':
    'Reportar o bloquear',
  'Portrait of {name}':
    'Retrato de {name}',
  'About verified votes and your data':
    'Sobre los votos verificados y tus datos',
  'Jump to {section}':
    'Ir a {section}',
  'Subcircuit {n} vacancies':
    'Vacantes del subcircuito {n}',
  '{ward} race':
    'Contienda del {ward}',
  'Police District {n} council race':
    'Contienda del consejo del Distrito Policial {n}',
  'your choice':
    'tu elección',
  'Link copied':
    'Enlace copiado',
  'Share':
    'Compartir',
  'just now':
    'ahora mismo',
  '{n}m ago':
    'hace {n} min',
  '{n}h ago':
    'hace {n} h',
  '{n}d ago':
    'hace {n} d',
  '1mo ago':
    'hace 1 mes',
  '{n}mo ago':
    'hace {n} meses',
  '1y ago':
    'hace 1 año',
  '{n}y ago':
    'hace {n} años',
  'Ward {n}':
    'Distrito {n}',
  'Board President':
    'Presidente del Consejo',
  'District {n}':
    'Distrito {n}',
  'in {n} days':
    'en {n} días',
  'You don’t have permission to do this.':
    'No tienes permiso para hacer esto.',
  'That wasn’t found.':
    'No se encontró.',
  'That already exists.':
    'Esto ya existe.',
  'You’ve reached the limit for now. Try again later.':
    'Llegaste al límite por ahora. Inténtalo más tarde.',
  'That can’t be done yet.':
    'Esto no se puede hacer todavía.',
  'Something in what you entered isn’t valid.':
    'Algo en lo que escribiste no es válido.',
  'No connection. Check your connection and try again.':
    'Sin conexión. Revisa tu conexión e inténtalo de nuevo.',
  'That took too long. Try again.':
    'Tardó demasiado. Inténtalo de nuevo.',
  'Something went wrong on the server. Try again.':
    'Algo salió mal en el servidor. Inténtalo de nuevo.',

  // District lookup and top-up (2026-09-29).
  'Your districts':
    'Tus distritos',
  'Districts found':
    'Distritos encontrados',
  'The election tab now shows your races first.':
    'La pestaña de elecciones ahora muestra primero tus carreras.',
  'Could not look up that address':
    'No se pudo buscar esa dirección',
  'You can look up 5 addresses a day. Try again tomorrow.':
    'Puedes buscar 5 direcciones al día. Inténtalo de nuevo mañana.',
  'Your districts ({ward})':
    'Tus distritos ({ward})',
  'Your ballot depends on your address, not just your ward. We send it to the US Census Bureau to place it on the map and keep only your district numbers, never the address.':
    'Tu boleta depende de tu dirección, no solo de tu distrito municipal. La enviamos a la Oficina del Censo de EE. UU. para ubicarla en el mapa y solo guardamos los números de tus distritos, nunca la dirección.',
  '1234 N Clark St':
    '1234 N Clark St',
  'Your home address':
    'Tu domicilio',
  'We couldn’t find that address. Check the street number and name.':
    'No encontramos esa dirección. Revisa el número y el nombre de la calle.',
  'That address is outside Chicago.':
    'Esa dirección está fuera de Chicago.',
  'Find my districts':
    'Buscar mis distritos',
  'Your district ({n}) has no race on this ballot.':
    'Tu distrito ({n}) no tiene carrera en esta boleta.',
  'None of your ward’s districts has a race on this ballot.':
    'Ninguno de los distritos que tocan tu distrito municipal tiene carrera en esta boleta.',
  'Hide the others':
    'Ocultar los demás',
  'See all {n}':
    'Ver los {n}',
  'US House':
    'Cámara de Representantes de EE. UU.',
  'Board of Review':
    'Junta de Revisión',
  'Judicial subcircuit':
    'Subcircuito judicial',
  'Police district':
    'Distrito policial',
  'Open Settings':
    'Abrir Ajustes',
  'That address is in the {ward}, and your home ward is the {home}. Change your home ward first, then look up the address.':
    'Esa dirección está en el {ward} y tu distrito es el {home}. Primero cambia tu distrito y luego busca la dirección.',
  'That address is in the {ward}, and your verified ward is the {home}. If you moved, verify your new address in Settings.':
    'Esa dirección está en el {ward} y tu distrito verificado es el {home}. Si te mudaste, verifica tu nueva dirección en Ajustes.',
  'Use a different address':
    'Usar otra dirección',
  'Your district':
    'Tu distrito',
  'Your ward’s districts':
    'Distritos que tocan tu distrito municipal',
  'If you verify: a yes/no verified flag, your ward and district numbers, and a unique identifier used to block duplicate accounts. Nothing else, and it is deleted with your account.':
    'Si te verificas: un indicador sí/no de verificación, tu distrito municipal y los números de tus distritos, y un identificador único que bloquea cuentas duplicadas. Nada más, y se elimina con tu cuenta.',
  'If you look up your districts without verifying: the district numbers only, so the election tab can show your races first.':
    'Si buscas tus distritos sin verificarte: solo los números de los distritos, para que la pestaña de elecciones muestre primero tus carreras.',
  'If you turn on phone notifications: each phone’s notification address and the language it shows them in. Signing out removes that phone.':
    'Si activas las notificaciones en el teléfono: la dirección de notificaciones de cada teléfono y el idioma en que las muestra. Al cerrar sesión se quita ese teléfono.',
  'Your address. It is used only at the moment you verify or look up your districts, to find your ward and districts, and is never saved.':
    'Tu domicilio. Solo se usa en el momento en que te verificas o buscas tus distritos, para encontrar tu distrito municipal y tus distritos, y nunca se guarda.',
  'Delete your account any time from Settings: your sign-in, profile, verification status, and every vote you cast are removed, and the tallies drop your votes. Anything you posted is re-attributed to [deleted].':
    'Elimina tu cuenta en cualquier momento desde Ajustes: se eliminan tu acceso, tu perfil, tu estado de verificación y cada voto que emitiste, y los conteos descuentan tus votos. Lo que publicaste se reatribuye a [deleted].',
  // Review fixes (2026-09-29).
  'Verification is handled by Didit, an independent identity service. Your documents go to Didit, never to us - all we ever receive is a yes/no, your ward, and your district numbers.':
    'La verificación la maneja Didit, un servicio independiente de identidad. Tus documentos van a Didit, nunca a nosotros; lo único que recibimos es un sí o no, tu distrito municipal y los números de tus distritos.',
  'One plank of your platform: a clear title, and all the space you need to make the case. Voters argue it out in the comments.':
    'Un punto de tu plataforma: un título claro y todo el espacio que necesites para defenderla. Los votantes lo discuten en los comentarios.',
  'This policy was imported from your campaign site. Saving takes it over: it becomes yours to manage here, its comments stay, and the site no longer updates it.':
    'Esta propuesta fue importada de tu sitio de campaña. Guardarla la toma: pasa a administrarse aquí, sus comentarios se conservan, y el sitio ya no la actualiza.',
  'This permanently removes the policy and its comments. It cannot be undone.':
    'Esto elimina permanentemente la propuesta y sus comentarios. No se puede deshacer.',
  'The policy and its comments were removed.': 'La propuesta y sus comentarios fueron eliminados.',
  'A poll can have up to 12 options.': 'Una votación puede tener hasta 12 opciones.',
  'Permanently removes your sign-in, profile, verification status, and every vote you cast (the tallies drop them). Anything you posted stays on the record but is re-attributed to [deleted]. This cannot be undone.':
    'Elimina permanentemente tu acceso, tu perfil, tu estado de verificación y cada voto que emitiste (los conteos los descuentan). Lo que publicaste queda en el registro pero se reatribuye a [deleted]. No se puede deshacer.',
  'This permanently removes your sign-in, profile, verification, and every vote you cast. Posts stay on the record as [deleted]. It cannot be undone.':
    'Esto elimina permanentemente tu acceso, tu perfil, tu verificación y cada voto que emitiste. Las publicaciones quedan en el registro como [deleted]. No se puede deshacer.',
  'All we ever save: a verified yes/no, your ward and district numbers, and a unique identifier that stops one person from verifying twice.':
    'Lo único que guardamos: un sí/no de verificación, tu distrito municipal y los números de tus distritos, y un identificador único que impide que una persona se verifique dos veces.',
  'Could not check': 'No se pudo comprobar',
  'Public comment sign-up has closed': 'La inscripción para comentarios públicos ya cerró',
  'Grade {letter}': 'Calificación {letter}',
  'Take back my vote': 'Retirar mi voto',
  'Confirm your email address to finish signing in':
    'Confirma tu correo electrónico para terminar de iniciar sesión',
  'Questions with a response are part of the public record.':
    'Las preguntas con respuesta son parte del registro público.',
  'Only the official can respond to their AMA questions.':
    'Solo el oficial puede responder las preguntas de su AMA.',
  'This question already has a response.': 'Esta pregunta ya tiene una respuesta.',
  'Officials cannot judge their own responses.':
    'Los oficiales no pueden juzgar sus propias respuestas.',
  'No response to judge yet.': 'Todavía no hay una respuesta que juzgar.',
  'Officials cannot rate themselves.': 'Los oficiales no pueden calificarse a sí mismos.',
  'Set or verify your home ward to rate officials.':
    'Fija o verifica tu distrito para calificar a los oficiales.',
  'Only officials can edit an official card.':
    'Solo los oficiales pueden editar una tarjeta de oficial.',
  'The question alert threshold must be a whole number of upvotes, 1 or more.':
    'El umbral de alerta de preguntas debe ser un número entero de apoyos, 1 o más.',
  'You voted. Change your picks below, or clear them all to take your vote back.':
    'Ya votaste. Cambia tus opciones abajo, o desmárcalas todas para retirar tu voto.',
  'You voted. Tap another option to change it, or yours again to take it back.':
    'Ya votaste. Toca otra opción para cambiarlo, o la tuya otra vez para retirarlo.',
  'US House, District {n}': 'Cámara de Representantes de EE. UU., distrito {n}',
  'Illinois Senate, District {n}': 'Senado de Illinois, distrito {n}',
  'Illinois House, District {n}': 'Cámara de Illinois, distrito {n}',
  'Cook County Commissioner, District {n}': 'Comisionado del Condado de Cook, distrito {n}',
  'Board of Review, District {n}': 'Junta de Revisión, distrito {n}',
  'Circuit Court, Subcircuit {n}': 'Corte de Circuito, subcircuito {n}',
  'Police District {n} Council': 'Consejo del Distrito Policial {n}',
  'Three seats; the top three vote-getters win.':
    'Tres puestos; ganan los tres candidatos con más votos.',
  'the November 3 ballot': 'la boleta del 3 de noviembre',
  'the school board races': 'las carreras del consejo escolar',
  'the judicial ballot': 'la boleta judicial',
  'the district races': 'las carreras por distrito',
  'the mayoral candidate AMA': 'el AMA con candidatos a alcalde',
  'the February 2027 ward races': 'las carreras de concejales de febrero de 2027',
  'Help in your language: early voting ballots come in 12 languages, many sites have bilingual officials, and you may bring someone to interpret.':
    'Ayuda en tu idioma: las boletas de votación anticipada vienen en 12 idiomas, muchos sitios tienen funcionarios bilingües y puedes llevar a alguien que te interprete.',
  'downtown from October 1 (137 S. State St. and 69 W. Washington St., 6th floor), all 50 wards from October 19; any Chicago voter can use any site.':
    'en el centro desde el 1 de octubre (137 S. State St. y 69 W. Washington St., 6.º piso), en los 50 distritos desde el 19 de octubre; cualquier votante de Chicago puede usar cualquier sitio.',
  'Type a street address.': 'Escribe una dirección con calle y número.',
  'The address lookup is not answering right now. Try again in a few minutes.':
    'La búsqueda de direcciones no responde en este momento. Inténtalo de nuevo en unos minutos.',
  'Write at least 10 characters.': 'Escribe al menos 5 caracteres.',
  'That’s longer than this box allows.': 'Es más largo de lo que permite este campo.',
  'You have looked up 5 addresses today. Try again tomorrow.':
    'Hoy ya buscaste 5 direcciones. Inténtalo de nuevo mañana.',
  // Moderation, priority scale, grade basis, early voting (2026-09-29).
  'Community rules': 'Normas de la comunidad',
  'Keep it about Chicago and the people who govern it.':
    'Habla de Chicago y de quienes lo gobiernan.',
  'No threats, harassment, or hate aimed at a person or a group.':
    'Nada de amenazas, acoso ni odio contra una persona o un grupo.',
  'No spam, ads, or the same post over and over.':
    'Nada de spam, anuncios ni la misma publicación una y otra vez.',
  'No one’s private information: home addresses, phone numbers, and the like.':
    'Nada de información privada de nadie: domicilios, números de teléfono y cosas así.',
  'Don’t pose as someone else, officials included.':
    'No te hagas pasar por otra persona, tampoco por funcionarios.',
  'Nothing sexual involving minors. We report it to the authorities.':
    'Nada sexual que involucre a menores. Lo denunciamos a las autoridades.',
  'Reported posts are reviewed every week. Posts that break these rules come down, and serious or repeated cases lose the account. An account reported by 5 or more people is hidden until it is reviewed.':
    'Las publicaciones reportadas se revisan cada semana. Las que rompen estas normas se retiran, y en los casos graves o repetidos se pierde la cuenta. Una cuenta reportada por 5 o más personas queda oculta hasta que se revise.',
  'From {residents} · {questions}': 'Según {residents} · {questions}',
  'Your ward’s site, from {date}': 'El sitio de tu distrito, desde el {date}',
  'Election officials there speak your language.':
    'Los funcionarios electorales de ese sitio hablan tu idioma.',
  'Minor': 'Leve',
  'Urgent': 'Urgente',
  'verified resident': 'residente verificado',
  'graded question': 'pregunta calificada',
  'graded questions': 'preguntas calificadas',
  'October 19': '19 de octubre',
  'Weekdays 9 am to 6 pm, Saturdays 9 am to 5 pm, Sundays 10 am to 4 pm.':
    'Entre semana de 9 am a 6 pm, sábados de 9 am a 5 pm, domingos de 10 am a 4 pm.',
  // Reports: a reason for "Other" (2026-09-30).
  'What’s wrong with it?': '¿Qué tiene de malo?',
  'Send report': 'Enviar reporte',
  'Back': 'Volver',
  'Say what’s wrong with it (at least 5 characters).': 'Di qué tiene de malo (al menos 5 caracteres).',

  // Deadline wording and Council actions (2026-09-30).
  'Not found':
    'No encontrado',
  'This page doesn’t exist, or it was removed.':
    'Esta página no existe o fue eliminada.',
  'Go to the home tab':
    'Ir a la pestaña de inicio',
  'Early voting opens downtown':
    'La votación anticipada abre en el centro',
  'At 137 S. State St. and 69 W. Washington St. Sites in every ward open October 19.':
    'En 137 S. State St. y 69 W. Washington St. Los sitios de cada distrito abren el 19 de octubre.',
  'Registering with a paper form by mail closes':
    'El registro de votantes con formulario en papel por correo cierra',
  'Online registration stays open through October 18, and in-person registration through election day.':
    'El registro en línea sigue abierto hasta el 18 de octubre, y el registro en persona hasta el día de la elección.',
  'You can still register in person at an early voting site or at your polling place on election day, with two forms of ID.':
    'Aún puedes registrarte en persona en un sitio de votación anticipada o en tu lugar de votación el día de la elección, con dos identificaciones.',
  'One site per ward, plus the two downtown. Any Chicago voter can use any site.':
    'Un sitio por distrito, más los dos del centro. Cualquier votante de Chicago puede usar cualquier sitio.',
  'Already have a mail ballot? Mail it back postmarked by November 3, or use a drop box at an early voting site.':
    '¿Ya tienes tu boleta por correo? Devuélvela por correo con matasellos del 3 de noviembre o antes, o usa un buzón seguro en un sitio de votación anticipada.',
  'Polls are open 6 am to 7 pm. Mail ballots must be postmarked by November 3.':
    'Las urnas abren de 6 am a 7 pm. Las boletas por correo deben tener matasellos del 3 de noviembre o antes.',
  'Mayor, city clerk and treasurer, alderman, and police district council.':
    'Alcalde, secretario y tesorero municipales, concejal y consejo de distrito policial.',
  'apply by October 29; ballots have been mailing since September 24; mail yours back postmarked by November 3 (it must arrive by November 17), or leave it in the secured drop box at any open early voting site.':
    'solicita a más tardar el 29 de octubre; las boletas se vienen enviando desde el 24 de septiembre; devuelve la tuya por correo con matasellos del 3 de noviembre o antes (debe llegar a más tardar el 17 de noviembre), o déjala en el buzón seguro de cualquier sitio de votación anticipada abierto.',
  'online through October 18 (needs an Illinois license or state ID), by mail through October 6, or in person through election day itself (starting October 7 at any open early voting site, and at your polling place on election day), with two forms of ID (one showing your address).':
    'en línea hasta el 18 de octubre (requiere licencia o identificación de Illinois), por correo hasta el 6 de octubre, o en persona hasta el mismo día de la elección (a partir del 7 de octubre en cualquier sitio de votación anticipada abierto, y en tu lugar de votación el día de la elección), con dos identificaciones (una con tu dirección).',
  'Passed':
    'Aprobado',
  'Adopted':
    'Adoptado',
  'Failed to Pass':
    'No aprobado',
  'Approved':
    'Aprobado',
  'Recommended for Re-Referral':
    'Se recomienda volver a remitir',
  'Recommended Do Not Pass':
    'Se recomienda no aprobar',
  'Committee Discharged':
    'Comisión relevada',
  'Recommended to Pass':
    'Se recomienda aprobar',
  'Your ward’s site, open starting {date}':
    'El sitio de tu distrito, abierto a partir del {date}',
  'downtown starting October 1 (137 S. State St. and 69 W. Washington St., 6th floor), and in all 50 wards starting October 19; any Chicago voter can use any site.':
    'en el centro a partir del 1 de octubre (137 S. State St. y 69 W. Washington St., 6.º piso), y en los 50 distritos a partir del 19 de octubre; cualquier votante de Chicago puede usar cualquier sitio.',
  'November 3, 2026 ballot':
    'Boleta del 3 de noviembre de 2026',
  'February 23, 2027 ballot':
    'Boleta del 23 de febrero de 2027',
  'See the races on your ballot':
    'Mira las contiendas de tu boleta',
  'Congress, the state legislature, the county board, judges, and the school board are drawn by district, and your street address decides which of those races you vote in. Enter it once and your races show up here, first. We keep only the district numbers, never the address.':
    'El Congreso, la legislatura estatal, la junta del condado, los jueces y la junta escolar se eligen por distrito, y tu dirección decide en cuáles de esas contiendas votas. Escríbela una vez y tus contiendas aparecen aquí, primero. Solo guardamos los números de distrito, nunca la dirección.',
  'Find my races':
    'Buscar mis contiendas',
  'Sign in to find your races':
    'Inicia sesión para ver tus contiendas',
  'Your races':
    'Tus contiendas',
  'Decided by your address in the {ward}':
    'Según tu dirección en el {ward}',
  'No candidates on record yet':
    'Aún no hay candidatos registrados',
  'Not on your ballot this year: {list}.':
    'No están en tu boleta este año: {list}.',
  'Every Chicagoan also votes on the offices below.':
    'Además, todos en Chicago votan por los cargos de abajo.',
  'Your races first, then when and where to vote, the offices every Chicagoan votes on, the school board, judges, and every district race.':
    'Primero tus contiendas; luego cuándo y dónde votar, los cargos que vota todo Chicago, la junta escolar, los jueces y cada contienda por distrito.',
  'Directions': 'Cómo llegar',
  'A declared write-in: the name is not printed on the ballot.':
    'Candidatura por escrito declarada: el nombre no está impreso en la boleta.',
  'A form for officials to ask constituents a question as a poll, either in their ward or citywide.':
    'Un formulario para que los oficiales hagan una pregunta a sus representados en forma de votación, en su distrito o en toda la ciudad.',
  'A form for raising a concern that others can prioritize, either citywide on the big board or in one ward.':
    'Un formulario para plantear una preocupación que otros pueden priorizar, para toda la ciudad en el tablero o en un distrito.',
  'A mayoral candidate\'s card and platform: a note on what they have published, an AI summary, and every policy grouped by section, each showing its comment count.':
    'La tarjeta y la plataforma de un candidato a la alcaldía: una nota sobre lo que ha publicado, un resumen de IA y cada propuesta agrupada por sección, cada una con su número de comentarios.',
  'A question put to every mayoral candidate, with each candidate\'s answer side by side. Readers\' votes set the order of the answers, and no vote counts are shown.':
    'Una pregunta hecha a todos los candidatos a la alcaldía, con la respuesta de cada uno lado a lado. Los votos de los lectores fijan el orden de las respuestas, y no se muestran conteos de votos.',
  'Add a comment in "Add to the discussion" and tap "Post comment", or tap "Reply" under a comment. The "..." button adds source links, and typing *1 in your text cites the first one.':
    'Escribe un comentario en “Súmate a la discusión” y toca “Publicar comentario”, o toca “Responder” debajo de un comentario. El botón “...” agrega enlaces a fuentes, y escribir *1 en tu texto cita el primero.',
  'Alderman now: {name}, not graded yet.':
    'Concejal actual: {name}, aún sin calificar.',
  'Alderman now: {name}, overall grade {letter}.':
    'Concejal actual: {name}, calificación general {letter}.',
  'Alderman: {name}, not graded yet.':
    'Concejal: {name}, aún sin calificar.',
  'Alderman: {name}, overall grade {letter}.':
    'Concejal: {name}, calificación general {letter}.',
  'An official\'s report card: an overall letter grade, constituent approval, an answers score, contact details, their AMA questions and responses, and, for aldermen, Council votes from the City Clerk.':
    'La ficha de calificaciones de un oficial: una calificación general con letra, la aprobación de sus representados, una puntuación de respuestas, datos de contacto, sus preguntas y respuestas de AMA y, para los concejales, las votaciones del Concejo según el Secretario Municipal.',
  'Answer within a week. A question left a week without a response counts as ignored in your grade, and questions from verified residents count double.':
    'Responde en menos de una semana. Una pregunta que pasa una semana sin respuesta cuenta como ignorada en tu calificación, y las preguntas de residentes verificados cuentan doble.',
  'Approval from verified residents: {pct}%, from {n} ratings.':
    'Aprobación de residentes verificados: {pct}%, de {n} calificaciones.',
  'Approval: not enough verified ratings yet (it takes 5).':
    'Aprobación: aún no hay suficientes calificaciones verificadas (se necesitan 5).',
  'Asked by {name} {ago}.':
    'Preguntado por {name} {ago}.',
  'Candidates who have answered: {n} ({names}).':
    'Candidatos que han respondido: {n} ({names}).',
  'Change your display name at any time, or block a user to hide their content from you.':
    'Cambia tu nombre visible en cualquier momento, o bloquea a un usuario para dejar de ver su contenido.',
  'Change your ward as often as you like, up to 5 times a day, until you post there. Two posts lock it for a week, and a third locks it for 3 months.':
    'Cambia tu distrito cuantas veces quieras, hasta 5 veces al día, hasta que publiques allí. Dos publicaciones lo bloquean por una semana, y una tercera lo bloquea por 3 meses.',
  'Check "What we never see": Didit checks your ID documents, and your address is used once to find your ward and districts, then never saved.':
    'Revisa “Qué nunca vemos”: Didit revisa tus documentos de identidad, y tu dirección se usa una sola vez para encontrar tu distrito y tus demás distritos, y nunca se guarda.',
  'Check "What we store": your email, your display name, what you post, your ballots, and, if you verify, only a yes or no, your ward and district numbers, and an identifier that blocks duplicate accounts.':
    'Revisa “Qué guardamos”: tu correo electrónico, tu nombre visible, lo que publicas, tus votos y, si te verificas, solo un sí o no, los números de tu distrito y tus demás distritos, y un identificador que bloquea cuentas duplicadas.',
  'Check back after candidates file on October 19-26, 2026. This page adds challengers as they announce and file.':
    'Vuelve después de que los candidatos se inscriban, del 19 al 26 de octubre de 2026. Esta página agrega a los retadores conforme se anuncian e inscriben.',
  'Check the "From N verified residents · N graded questions" line to see how many people and questions a grade comes from.':
    'Revisa la línea “De N residentes verificados · N preguntas calificadas” para ver de cuántas personas y preguntas sale una calificación.',
  'Check the status on each question: "Awaiting response", "Community reviewing", "Answered" or "Dodged".':
    'Revisa el estado de cada pregunta: “Esperando respuesta”, “La comunidad está evaluando”, “Respondida” o “Esquivada”.',
  'Choose "Citywide" or a ward under "Where does this belong?". If you have no home ward yet, verify your residency or set a home ward first.':
    'Elige “Toda la ciudad” o un distrito en “¿A dónde pertenece esto?”. Si aún no tienes distrito, primero verifica tu residencia o fija tu distrito.',
  'Choose a "Vote format": "Yes / No", "Multiple choice" (pick one), "Approval" (pick every option you support), or "5-point scale".':
    'Elige un “Formato de votación”: “Sí / No”, “Opción múltiple” (se elige una), “Aprobación” (se elige cada opción que se apoya) o “Escala de 5 puntos”.',
  'Choose which kinds also reach your phone in Settings, under "Phone notifications".':
    'Elige qué tipos llegan también a tu teléfono en Ajustes, en “Notificaciones en el teléfono”.',
  'Comments: {n}, newest {ago}.':
    'Comentarios: {n}, el más reciente {ago}.',
  'Compare candidates on this page. Each card shows their party, an "Incumbent" chip if they hold the seat, and a preview of what they are running on.':
    'Compara a los candidatos en esta página. Cada tarjeta muestra su partido, una etiqueta “Titular” si ocupa el puesto y un adelanto de lo que propone.',
  'Compare nominees on this page by the preview of what each is running on and the "Incumbent" chip.':
    'Compara a los candidatos en esta página por el adelanto de lo que propone cada uno y la etiqueta “Titular”.',
  'Compare the challengers under "Declared challengers" by background and a preview of what each is running on. Tap one to see their full card.':
    'Compara a los retadores en “Retadores declarados” por su trayectoria y un adelanto de lo que propone cada uno. Toca uno para ver su tarjeta completa.',
  'Concerns on the big board: {n}.':
    'Preocupaciones en el tablero: {n}.',
  'Concerns you raised: {concerns}. Questions you asked: {questions}.':
    'Preocupaciones que planteaste: {concerns}. Preguntas que hiciste: {questions}.',
  'Declared challengers: {names}.':
    'Retadores declarados: {names}.',
  'Declared write-ins: {w}.':
    'Candidaturas por escrito declaradas: {w}.',
  'Delete your account from Settings to remove your sign-in, profile, verification, and every vote you cast. Your posts stay, credited to [deleted].':
    'Elimina tu cuenta desde Ajustes para borrar tu acceso, tu perfil, tu verificación y cada voto que emitiste. Tus publicaciones se quedan, atribuidas a [deleted].',
  'Districts on file, from an address in the {ward}.':
    'Distritos guardados, según una dirección en el {ward}.',
  'Edit or withdraw a concern or a question from its own page. This page only lists them.':
    'Edita o retira una preocupación o una pregunta desde su propia página. Esta página solo las enumera.',
  'Every Chicago official on the app: citywide offices first, then each ward in order. Each row shows approval, an answers grade, an overall letter, and what the grade is based on.':
    'Cada oficial de Chicago en la app: primero los cargos de toda la ciudad, luego cada distrito en orden. Cada fila muestra la aprobación, una calificación de respuestas, una letra general y en qué se basa la calificación.',
  'Every ward\'s board is public. If you have a home ward, this opens on it: the ward\'s concerns, its alderman, and its open and past polls. Otherwise you see all 50 wards as a grid and a map.':
    'El tablero de cada distrito es público. Si tienes distrito, esto se abre en el tuyo: sus preocupaciones, su concejal y sus votaciones abiertas y pasadas. Si no, ves los 50 distritos en una cuadrícula y un mapa.',
  'Everything you have posted, newest first: the concerns you raised and the questions you asked officials.':
    'Todo lo que has publicado, lo más reciente primero: las preocupaciones que planteaste y las preguntas que les hiciste a los oficiales.',
  'Fill in a "Title" of at least 3 characters, an optional "Section", and "The policy", which can be up to 20,000 characters.':
    'Llena un “Título” de al menos 3 caracteres, una “Sección” opcional y “La propuesta”, que puede tener hasta 20,000 caracteres.',
  'Find your school board district with "Find my races" on the election tab. School board districts do not follow ward lines.':
    'Encuentra tu distrito del consejo escolar con “Buscar mis contiendas” en la pestaña de elecciones. Los distritos del consejo escolar no siguen los límites de los distritos de concejales.',
  'For multiple choice or approval, list 2 to 12 options under "Options (one per line)".':
    'Para opción múltiple o aprobación, escribe de 2 a 12 opciones en “Opciones (una por línea)”.',
  'Help':
    'Ayuda',
  'Help with this page':
    'Ayuda con esta página',
  'Holds the seat now.':
    'Ocupa el puesto actualmente.',
  'If asked to confirm your email first, tap "Send confirmation email", open the email, then tap "I confirmed it". Google and Apple accounts skip this step.':
    'Si se te pide confirmar tu correo primero, toca “Enviar correo de confirmación”, abre el correo y luego toca “Ya lo confirmé”. Las cuentas de Google y Apple se saltan este paso.',
  'If asked, tap "Send confirmation email" and then "I confirmed it". Until then you can read but not answer, post, or edit.':
    'Si se te pide, toca “Enviar correo de confirmación” y luego “Ya lo confirmé”. Hasta entonces puedes leer, pero no responder, publicar ni editar.',
  'If asked, tap "Send confirmation email" and then "I confirmed it". Until then you can read but not respond, post, or edit.':
    'Si se te pide, toca “Enviar correo de confirmación” y luego “Ya lo confirmé”. Hasta entonces puedes leer, pero no contestar, publicar ni editar.',
  'If the address is in a different ward than your home ward, tap "Change home ward" first. If you are verified, tap "Open Settings" to verify your new address.':
    'Si la dirección está en un distrito distinto al tuyo, primero toca “Cambiar de distrito”. Si estás verificado, toca “Abrir Ajustes” para verificar tu nueva dirección.',
  'If they have a "Write-in" chip, tap "How to mark your ballot (Board of Elections)" to learn how to write in a name.':
    'Si tiene la etiqueta “Por escrito”, toca “Cómo marcar tu boleta (Junta Electoral)” para saber cómo escribir un nombre.',
  'If you are verified or an official, this page only shows your ward. Verified people move wards by verifying a new address in Settings.':
    'Si estás verificado o eres oficial, esta página solo muestra tu distrito. Las personas verificadas cambian de distrito verificando una nueva dirección en Ajustes.',
  'If you asked the question, tap "Edit" or "Withdraw question". Both are available until the first candidate answers.':
    'Si hiciste la pregunta, toca “Editar” o “Retirar la pregunta”. Ambas opciones están disponibles hasta que responda el primer candidato.',
  'If you later pick a different home ward, your saved districts are cleared.':
    'Si después eliges otro distrito, se borran tus distritos guardados.',
  'If you never open the verification link, your free attempt or your payment carries over to your next try. A verification already in progress continues where you left off.':
    'Si nunca abres el enlace de verificación, tu intento gratis o tu pago pasa a tu siguiente intento. Una verificación ya en curso sigue donde la dejaste.',
  'If your platform comes from your campaign site, tap "Sync from my site" to update it now instead of waiting for the nightly sync. Editing an imported policy stops future syncs from changing it.':
    'Si tu plataforma viene de tu sitio de campaña, toca “Sincronizar desde mi sitio” para actualizarla ahora en vez de esperar la sincronización de cada noche. Editar una propuesta importada evita que futuras sincronizaciones la cambien.',
  'Incumbent: {name}.':
    'Titular: {name}.',
  'Judges with a negative bar association rating: {n}.':
    'Jueces con una calificación negativa de un colegio de abogados: {n}.',
  'Know that an account reported by 5 or more different people is hidden until it is reviewed.':
    'Una cuenta reportada por 5 o más personas distintas queda oculta hasta que se revisa.',
  'Know that an address outside Chicago changes nothing. A new ward replaces your old one, and you can move once every 3 months.':
    'Una dirección fuera de Chicago no cambia nada. Un distrito nuevo reemplaza al anterior, y puedes mudarte una vez cada 3 meses.',
  'Know that reports are reviewed every week. Posts that break the rules come down, and serious or repeated cases lose the account.':
    'Los reportes se revisan cada semana. Las publicaciones que rompen las normas se eliminan, y en casos graves o repetidos se pierde la cuenta.',
  'Know that saving a policy imported from your campaign site takes it over. It becomes yours to manage here, its comments stay, and the site stops updating it.':
    'Guardar una propuesta importada de tu sitio de campaña la hace tuya. Pasas a administrarla aquí, sus comentarios se quedan y el sitio deja de actualizarla.',
  'Know that the app keeps only a verified yes or no, your ward and district numbers, and an identifier that stops one ID from verifying twice.':
    'La app guarda solo un sí o no de verificación, los números de tu distrito y tus demás distritos, y un identificador que impide que una identificación se verifique dos veces.',
  'Know that the first 500 checks each month are free, with 3 free attempts per account every 3 months. After that, the button shows the store\'s price.':
    'Las primeras 500 verificaciones de cada mes son gratis, con 3 intentos gratis por cuenta cada 3 meses. Después, el botón muestra el precio de la tienda.',
  'Know that ward polls take votes from people whose home ward is yours. Verified residents are counted separately in both kinds of poll.':
    'Las votaciones del distrito reciben votos de las personas cuyo distrito es el tuyo. Los residentes verificados se cuentan aparte en ambos tipos de votación.',
  'Know that your address is sent to the US Census Bureau to find it on the map. The app keeps only your district numbers, never the address.':
    'Tu dirección se envía a la Oficina del Censo de EE. UU. para ubicarla en el mapa. La app guarda solo los números de tus distritos, nunca la dirección.',
  'Language: {name}.':
    'Idioma: {name}.',
  'List up to 20 source links under "Receipts - source links", one per line. Each must start with https://.':
    'Escribe hasta 20 enlaces a fuentes en “Fuentes - enlaces”, uno por línea. Cada uno debe empezar con https://.',
  'Look for "on the platform" to see which officials have claimed their profile and answer questions here.':
    'Busca “en la plataforma” para ver qué oficiales han reclamado su perfil y responden preguntas aquí.',
  'Look for the "candidate" chip on the candidate\'s own replies, and "writing credit" on comments they credited for shaping the policy.':
    'Busca la etiqueta “candidato” en las respuestas del propio candidato, y “crédito de autoría” en los comentarios que reconoció por ayudar a dar forma a la propuesta.',
  'Look for the dot and bold title, which mark notifications you haven\'t opened yet.':
    'Busca el punto y el título en negrita, que marcan las notificaciones que aún no has abierto.',
  'Look under "Write-in candidates" for declared write-ins, whose names are not printed on the ballot, and read how to write one in.':
    'Busca en “Candidaturas por escrito” a los candidatos por escrito declarados, cuyos nombres no están impresos en la boleta, y lee cómo escribir uno.',
  'Look under "Write-in candidates" for declared write-ins. Their names are not printed on the ballot, and the section explains how to write one in.':
    'Busca en “Candidaturas por escrito” a los candidatos por escrito declarados. Sus nombres no están impresos en la boleta, y la sección explica cómo escribir uno.',
  'Look up at most 5 addresses a day. Addresses outside Chicago are refused.':
    'Puedes buscar como máximo 5 direcciones al día. Las direcciones fuera de Chicago se rechazan.',
  'Mayoral candidates on the platform: {n}.':
    'Candidatos a la alcaldía en la plataforma: {n}.',
  'Moved within Chicago? Once verified, tap "Verify with my ID" or "Verify with a bill or statement". You can do this once every 3 months.':
    '¿Te mudaste dentro de Chicago? Ya verificado, toca “Verificar con mi identificación” o “Verificar con un recibo o estado de cuenta”. Puedes hacerlo una vez cada 3 meses.',
  'Newest comment on your platform: {ago}, on “{title}”.':
    'Comentario más reciente en tu plataforma: {ago}, en “{title}”.',
  'No address on file yet.':
    'Aún no hay una dirección guardada.',
  'No address on file, so your own races are not listed first yet.':
    'No hay una dirección guardada, así que tus contiendas todavía no aparecen primero.',
  'No candidate has answered yet.':
    'Ningún candidato ha respondido todavía.',
  'No candidates are listed yet.':
    'Aún no hay candidatos en la lista.',
  'No challengers have declared yet.':
    'Aún no se ha declarado ningún retador.',
  'No citywide polls are open.':
    'No hay votaciones abiertas para toda la ciudad.',
  'No one has voted on it yet.':
    'Nadie ha votado todavía.',
  'No questions are waiting for your response.':
    'No hay preguntas esperando tu respuesta.',
  'No ward polls are open.':
    'No hay votaciones del distrito abiertas.',
  'Not graded yet.':
    'Aún sin calificar.',
  'Not on the platform yet. Their unanswered questions stay waiting, never counted as ignored.':
    'Aún no está en la plataforma. Sus preguntas sin responder siguen en espera y nunca cuentan como ignoradas.',
  'Notifications: {n}, unread: {unread}.':
    'Notificaciones: {n}, sin leer: {unread}.',
  'Officials listed: {n}.':
    'Oficiales en la lista: {n}.',
  'On "Judges up for retention", each judge is a separate yes-or-no question on your ballot. A judge needs 60 percent yes to stay.':
    'En “Jueces en votación de retención”, cada juez es una pregunta aparte de sí o no en tu boleta. Un juez necesita 60 por ciento de votos a favor para seguir.',
  'On a ward concern, tap "Report it to 311" at the bottom if it is also a city service problem.':
    'En una preocupación del distrito, toca “Repórtalo al 311” al final si también es un problema de servicio de la ciudad.',
  'On judge races, read each rating chip as the bar association or Injustice Watch worded it. Tap a chip to open that group\'s evaluation.':
    'En las contiendas judiciales, cada etiqueta de calificación dice lo que escribió el colegio de abogados o Injustice Watch. Toca una etiqueta para abrir la evaluación de ese grupo.',
  'On the February 23, 2027 ballot.':
    'En la boleta del 23 de febrero de 2027.',
  'On the November 3, 2026 ballot.':
    'En la boleta del 3 de noviembre de 2026.',
  'On the ballot: {n}.':
    'En la boleta: {n}.',
  'On the ballot: {n}. Declared write-ins: {w}.':
    'En la boleta: {n}. Candidaturas por escrito declaradas: {w}.',
  'On the platform, answering questions here: {n}.':
    'En la plataforma, respondiendo preguntas aquí: {n}.',
  'On the platform: they answer questions here.':
    'En la plataforma: responde preguntas aquí.',
  'On this page':
    'En esta página',
  'On your own concern, tap "Edit" or "Withdraw concern". Withdrawing deletes it with all its votes and comments. "Edited · See edit history" shows earlier versions.':
    'En tu propia preocupación, toca “Editar” o “Retirar la preocupación”. Retirarla la borra con todos sus votos y comentarios. “Editado · Ver el historial de ediciones” muestra las versiones anteriores.',
  'On your own question, tap "Edit" or "Withdraw my question". Both are available until the official responds.':
    'En tu propia pregunta, toca “Editar” o “Retirar mi pregunta”. Ambas opciones están disponibles hasta que el oficial responda.',
  'One Chicago school board race on the November 3, 2026 ballot. It lists each nominee with the first lines of what they are running on. The line under the title tells you who votes in this race: every Chicagoan, or only that district\'s residents.':
    'Una contienda del consejo escolar de Chicago en la boleta del 3 de noviembre de 2026. Muestra a cada candidato con las primeras líneas de lo que propone. La línea bajo el título te dice quién vota en esta contienda: todos en Chicago, o solo los residentes de ese distrito.',
  'One ballot candidate\'s card, put together from public sources. It shows what they say they are running on, their background and, for judges, the seat, the court and their ratings. These candidates do not have accounts in the app.':
    'La tarjeta de un candidato en la boleta, armada con fuentes públicas. Muestra lo que dice que propone, su trayectoria y, para los jueces, el puesto, la corte y sus calificaciones. Estos candidatos no tienen cuenta en la app.',
  'One concern from the board: its ward or citywide label, the full text and sources, how much people say it matters, and the comments. Results show all users and verified residents side by side.':
    'Una preocupación del tablero: su etiqueta de distrito o de toda la ciudad, el texto completo y las fuentes, cuánto dice la gente que importa y los comentarios. Los resultados muestran a todos los usuarios y a los residentes verificados lado a lado.',
  'One policy from a candidate\'s platform in full, with the sources behind it and a comment thread where people argue for or against it.':
    'Una propuesta completa de la plataforma de un candidato, con sus fuentes y un hilo de comentarios donde la gente argumenta a favor o en contra.',
  'One race on the November 3, 2026 or February 23, 2027 ballot. It lists every candidate, with the first lines of what each says they are running on, so you can compare them here. Judge races also show the seat, the court and bar association ratings.':
    'Una contienda de la boleta del 3 de noviembre de 2026 o del 23 de febrero de 2027. Muestra a cada candidato con las primeras líneas de lo que dice que propone, para que los compares aquí. Las contiendas judiciales también muestran el puesto, la corte y las calificaciones de los colegios de abogados.',
  'One school board nominee\'s card, put together from public sources. It shows what they say they are running on, their background and their campaign site. Nominees do not have accounts in the app.':
    'La tarjeta de un candidato al consejo escolar, armada con fuentes públicas. Muestra lo que dice que propone, su trayectoria y su sitio de campaña. Estos candidatos no tienen cuenta en la app.',
  'One ward\'s race for alderman on the February 23, 2027 ballot. It shows the current alderman\'s report card from this app next to everyone who has declared against them.':
    'La contienda por la concejalía de un distrito en la boleta del 23 de febrero de 2027. Muestra la ficha de calificaciones del concejal actual en esta app junto a todos los que se han declarado en su contra.',
  'Open "Injustice Watch judicial guide" or "Chicago Bar Association evaluations" from the box at the top of any judge race.':
    'Abre “Guía judicial de Injustice Watch” o “Evaluaciones del Colegio de Abogados de Chicago” desde el recuadro de arriba en cualquier contienda judicial.',
  'Open citywide polls: {n}.':
    'Votaciones abiertas para toda la ciudad: {n}.',
  'Open polls from this candidate: {n}.':
    'Votaciones abiertas de este candidato: {n}.',
  'Open ward polls: {n}.':
    'Votaciones abiertas del distrito: {n}.',
  'Overall grade: {letter}.':
    'Calificación general: {letter}.',
  'Party: {party}.':
    'Partido: {party}.',
  'People who joined it: {n}, verified: {verified}.':
    'Personas que la apoyan: {n}, verificadas: {verified}.',
  'People you have blocked: {n}.':
    'Personas que bloqueaste: {n}.',
  'Pick a ward from the number grid or the map. Tap "All wards" to browse others and "Back to my ward" to return.':
    'Elige un distrito en la cuadrícula de números o en el mapa. Toca “Todos los distritos” para ver otros y “Volver a mi distrito” para regresar.',
  'Pick your home ward without showing an ID. A home ward lets you vote on ward polls, rate your alderman, and post up to 3 times a day there. Your votes count in the all-users totals, not the verified ones.':
    'Elige tu distrito sin mostrar una identificación. Con un distrito puedes votar en las votaciones del distrito, calificar a tu concejal y publicar allí hasta 3 veces al día. Tus votos cuentan en los totales de todos los usuarios, no en los verificados.',
  'Policies on the platform: {n}. Comments on them: {comments}.':
    'Propuestas en la plataforma: {n}. Comentarios en ellas: {comments}.',
  'Policies on your platform: {n}.':
    'Propuestas en tu plataforma: {n}.',
  'Post in a ward that isn\'t your home ward once a week, in up to 5 such wards a week.':
    'Publica en un distrito que no es el tuyo una vez por semana, en hasta 5 de esos distritos por semana.',
  'Post up to 2 citywide concerns a day, and up to 3 a day in your home ward.':
    'Publica hasta 2 preocupaciones de toda la ciudad al día, y hasta 3 al día en tu distrito.',
  'Prove you are an adult Chicago resident through Didit, a third-party identity service, so your votes count in your ward\'s verified tallies. Opened from Settings, this page verifies a new address after a move.':
    'Demuestra con Didit, un servicio de identidad independiente, que eres un adulto residente de Chicago, para que tus votos cuenten en los conteos verificados de tu distrito. Abierta desde Ajustes, esta página verifica una nueva dirección después de una mudanza.',
  'Questions to every candidate: {n}. You have not answered {open} of them.':
    'Preguntas a todos los candidatos: {n}. No has respondido {open} de ellas.',
  'Questions waiting for your response: {n}.':
    'Preguntas esperando tu respuesta: {n}.',
  'Questions: {answered} answered, {dodged} dodged, {ignored} ignored, {pending} waiting.':
    'Preguntas: {answered} respondidas, {dodged} esquivadas, {ignored} ignoradas, {pending} en espera.',
  'Ranked by verified votes only.':
    'Ordenado solo por votos verificados.',
  'Ranked by votes from all users.':
    'Ordenado por los votos de todos los usuarios.',
  'Ranked first: “{title}”.':
    'En primer lugar: “{title}”.',
  'Ranked first: “{title}”. Votes: {n}.':
    'En primer lugar: “{title}”. Votos: {n}.',
  'Rate comments with the up and down arrows to rank them under "Best". Tap your arrow again to take it back. "Newest" sorts by time.':
    'Califica los comentarios con las flechas hacia arriba y hacia abajo para ordenarlos en “Mejores”. Toca tu flecha otra vez para quitar tu voto. “Recientes” los ordena por fecha.',
  'Rated 4 or 5: {all}% of all votes, {verified}% of verified votes.':
    'Calificada con 4 o 5: {all}% de todos los votos, {verified}% de los votos verificados.',
  'Rated 4 or 5: {all}% of votes.':
    'Calificada con 4 o 5: {all}% de los votos.',
  'Ratings listed: {n}, negative: {neg}.':
    'Calificaciones en la lista: {n}, negativas: {neg}.',
  'Read "% approval" as the approval of verified residents only. It shows "-" until 5 verified residents of the ward have voted.':
    '“% de aprobación” es la aprobación solo de los residentes verificados. Muestra “-” hasta que voten 5 residentes verificados del distrito.',
  'Read "How your home ward works", then tap "Next" to get to the ward picker. If you already have a ward, you go straight to the picker.':
    'Lee “Cómo funciona tu distrito” y luego toca “Siguiente” para llegar al selector de distrito. Si ya tienes distrito, vas directo al selector.',
  'Read "Results" for each level\'s count and percentage, all users and verified. On a ward concern, the verified count includes only verified residents of that ward.':
    'En “Resultados” ves el conteo y el porcentaje de cada nivel, de todos los usuarios y de los verificados. En una preocupación del distrito, el conteo verificado incluye solo a los residentes verificados de ese distrito.',
  'Read "Running on" for what they say they will do, and "Background" for their work history.':
    'Lee “Se postula por” para saber lo que dice que hará, y “Trayectoria” para su historial laboral.',
  'Read "Running on" for what they say they will do. For a judge up for retention, this section is called "Record".':
    'Lee “Se postula por” para saber lo que dice que hará. Para un juez en votación de retención, esta sección se llama “Historial”.',
  'Read the line under the grade. It shows how many verified residents rated the alderman and how many questions were graded.':
    'Lee la línea bajo la calificación. Muestra cuántos residentes verificados calificaron al concejal y cuántas preguntas se calificaron.',
  'Read the six rules: keep it about Chicago and its government, and no threats, harassment, hate, spam, private information, impersonation, or sexual content involving minors.':
    'Lee las seis normas: que sea sobre Chicago y su gobierno, y nada de amenazas, acoso, odio, spam, información privada, suplantación de identidad ni contenido sexual que involucre a menores.',
  'Running: {names}.':
    'Se postulan: {names}.',
  'See who can read what. Only you can see your profile and ballots. Others see your display name, a verified badge, and vote totals.':
    'Mira quién puede leer qué. Solo tú puedes ver tu perfil y tus votos. Los demás ven tu nombre visible, una insignia de verificación y los totales de votos.',
  'Showing all 50 wards to pick from.':
    'Se muestran los 50 distritos para elegir.',
  'Showing the {ward}, your home ward.':
    'Se muestra el {ward}, tu distrito.',
  'Showing the {ward}.':
    'Se muestra el {ward}.',
  'Sign in to direct democracy or create an account. You can use an email and password, a sign-in link sent to your email, or Google or Apple.':
    'Inicia sesión en direct democracy o crea una cuenta. Puedes usar un correo y una contraseña, un enlace de acceso enviado a tu correo, o Google o Apple.',
  'Signed in as {name}.':
    'Sesión iniciada como {name}.',
  'Signed out, tap "Sign in first" to see your activity.':
    'Sin sesión iniciada, toca “Primero inicia sesión” para ver tu actividad.',
  'Signed out, tap "Sign in or create account", or open "Settings" or "Privacy & data".':
    'Sin sesión iniciada, toca “Inicia sesión o crea una cuenta”, o abre “Ajustes” o “Privacidad y datos”.',
  'Signed out, tap "Sign in to vote and comment".':
    'Sin sesión iniciada, toca “Inicia sesión para votar y comentar”.',
  'Signed out, tap "Sign in" to start getting notifications.':
    'Sin sesión iniciada, toca “Iniciar sesión” para empezar a recibir notificaciones.',
  'Sources listed: {n}.':
    'Fuentes en la lista: {n}.',
  'Still waiting for a response: {n}.':
    'Todavía esperando respuesta: {n}.',
  'Take back a vote while voting is open, withdraw your concerns and unanswered questions, and delete your comments. Ballots in a closed poll are final.':
    'Quita un voto mientras la votación esté abierta, retira tus preocupaciones y preguntas sin responder, y borra tus comentarios. Los votos en una votación cerrada son definitivos.',
  'Tap "Add a policy", or tap any policy to edit it. A policy you added yourself, not imported from your site, can also be hidden or deleted there.':
    'Toca “Agregar una propuesta”, o toca cualquier propuesta para editarla. Una propuesta que agregaste tú, no importada de tu sitio, también se puede ocultar o eliminar ahí.',
  'Tap "Add a reference link" to add up to 10 https links. Type *1 or *2 in your text to cite a link where readers can tap it.':
    'Toca “Agregar un enlace de referencia” para agregar hasta 10 enlaces https. Escribe *1 o *2 en tu texto para citar un enlace donde los lectores puedan tocarlo.',
  'Tap "All users" or "Verified only" to switch whose votes are counted and ranked. Tap "Highest rated" or "Newest" to change the order. Rank numbers stay the same either way.':
    'Toca “Todos los usuarios” o “Solo verificados” para cambiar de quién son los votos que se cuentan y ordenan. Toca “Mejor calificadas” o “Recientes” para cambiar el orden. Los números de posición no cambian.',
  'Tap "Approve" or "Disapprove", and tap your choice again to take it back. Rating takes a home ward. Only verified residents of the official\'s ward move the grade.':
    'Toca “Aprobar” o “Desaprobar”, y toca tu opción otra vez para quitarla. Para calificar necesitas tener distrito. Solo los residentes verificados del distrito del oficial mueven la calificación.',
  'Tap "Campaign site" to open their website, or tap the copy icon beside it to copy the link.':
    'Toca “Sitio de campaña” para abrir su sitio web, o toca el ícono de copiar a su lado para copiar el enlace.',
  'Tap "Campaign website" to open their site, or the copy icon beside it to copy the link.':
    'Toca “Sitio de campaña” para abrir su sitio, o el ícono de copiar a su lado para copiar el enlace.',
  'Tap "Create an account" or "Sign in" at the top to switch between making a new account and signing in to one you already have.':
    'Toca “Crear una cuenta” o “Iniciar sesión” arriba para cambiar entre crear una cuenta nueva e iniciar sesión en una que ya tienes.',
  'Tap "Delete my account…" and confirm twice to remove your sign-in, profile, verification, and every vote you cast. Your posts stay, credited to [deleted].':
    'Toca “Eliminar mi cuenta…” y confirma dos veces para borrar tu acceso, tu perfil, tu verificación y cada voto que emitiste. Tus publicaciones se quedan, atribuidas a [deleted].',
  'Tap "Delete" and confirm twice to remove the policy and all its comments for good.':
    'Toca “Eliminar” y confirma dos veces para borrar la propuesta y todos sus comentarios para siempre.',
  'Tap "Edit display name" to change your name, or "Shuffle" for a random one, then "Save". Your real identity is never shown.':
    'Toca “Editar nombre visible” para cambiar tu nombre, o “Aleatorio” para uno al azar, y luego “Guardar”. Tu identidad real nunca se muestra.',
  'Tap "Edit my card" to change your bio, portrait link, and campaign website. Tap "View your public page" to see it as voters do.':
    'Toca “Editar mi tarjeta” para cambiar tu biografía, el enlace de tu foto y tu sitio de campaña. Toca “Ver tu página pública” para verla como la ven los votantes.',
  'Tap "Edit my card" to change your bio, your portrait link, and the "Question alert threshold", the number of joins at which a question sends you an alert.':
    'Toca “Editar mi tarjeta” para cambiar tu biografía, el enlace de tu foto y el “Umbral de alerta de preguntas”, el número de apoyos con el que una pregunta te envía una alerta.',
  'Tap "Edit" or "Remove" on your own comments. "Edited · See edit history" shows earlier versions.':
    'Toca “Editar” o “Eliminar” en tus propios comentarios. “Editado · Ver el historial de ediciones” muestra las versiones anteriores.',
  'Tap "Email me a sign-in link" while signing in to get a link that signs you in with no password. Open it on this phone.':
    'Toca “Envíame un enlace de acceso” al iniciar sesión para recibir un enlace que te deja entrar sin contraseña. Ábrelo en este teléfono.',
  'Tap "Find my races" and enter your address once to see the races on your ballot first. Only the district numbers are kept, never the address.':
    'Toca “Buscar mis contiendas” y escribe tu dirección una vez para ver primero las contiendas de tu boleta. Solo se guardan los números de distrito, nunca la dirección.',
  'Tap "Forgot password?" to get an email with a link for setting a new password.':
    'Toca “¿Olvidaste tu contraseña?” para recibir un correo con un enlace para crear una contraseña nueva.',
  'Tap "Hide" to take a policy you wrote here off your public platform while keeping its comments. Tap "Unhide" to bring it back.':
    'Toca “Ocultar” para quitar de tu plataforma pública una propuesta que escribiste aquí, conservando sus comentarios. Toca “Mostrar de nuevo” para que vuelva.',
  'Tap "Mark all read" to clear every unread notification at once.':
    'Toca “Marcar todo como leído” para quitar todas las notificaciones sin leer de una vez.',
  'Tap "My activity" to see the concerns and questions you have posted.':
    'Toca “Mi actividad” para ver las preocupaciones y preguntas que has publicado.',
  'Tap "New ward poll" or "New citywide poll" to put a question to the public. You see live results on your own polls. Tap "Close voting" to end one.':
    'Toca “Nueva votación del distrito” o “Nueva votación para la ciudad” para hacerle una pregunta al público. En tus propias votaciones ves los resultados en vivo. Toca “Cerrar la votación” para terminar una.',
  'Tap "Not sure of your ward? Look up your address" to use the City of Chicago\'s ward lookup.':
    'Toca “¿No sabes tu distrito? Busca tu dirección” para usar el buscador de distritos de la Ciudad de Chicago.',
  'Tap "Open phone settings" if your phone has notifications turned off for this app.':
    'Toca “Abrir la configuración del teléfono” si tu teléfono tiene las notificaciones apagadas para esta app.',
  'Tap "Open the guide" for Injustice Watch\'s reporting on every judge on the ballot.':
    'Toca “Abrir la guía” para ver la investigación de Injustice Watch sobre cada juez en la boleta.',
  'Tap "Open the vote" to start the poll. You see live results but can\'t vote on your own poll. You close voting from the command center.':
    'Toca “Abrir la votación” para empezarla. Ves los resultados en vivo, pero no puedes votar en tu propia votación. La cierras desde el centro de mando.',
  'Tap "Post concern" to publish it and open it. When you\'ve hit a limit, the button stays off and a note says when you can post again.':
    'Toca “Publicar preocupación” para publicarla y abrirla. Si llegaste a un límite, el botón queda desactivado y una nota dice cuándo puedes volver a publicar.',
  'Tap "Privacy & data" to see what the app stores. "Community rules" is at the bottom of the page.':
    'Toca “Privacidad y datos” para ver lo que guarda la app. “Normas de la comunidad” está al final de la página.',
  'Tap "Publish policy" to add a new policy to the end of your platform, or "Save changes" to update one.':
    'Toca “Publicar propuesta” para agregar una propuesta nueva al final de tu plataforma, o “Guardar cambios” para actualizar una.',
  'Tap "Raise a concern" to post a citywide concern, up to 2 a day. Signed out, the button reads "Sign in to raise a concern".':
    'Toca “Plantea una preocupación” para publicar una preocupación de toda la ciudad, hasta 2 al día. Sin sesión iniciada, el botón dice “Inicia sesión para plantear una preocupación”.',
  'Tap "Raise a ward concern" to post in your home ward, up to 3 times a day. In other wards, tap "Raise a concern in this ward" to post once a week, in up to 5 wards a week.':
    'Toca “Plantea una preocupación del distrito” para publicar en tu distrito, hasta 3 veces al día. En otros distritos, toca “Plantear una preocupación en este distrito” para publicar una vez por semana, en hasta 5 distritos por semana.',
  'Tap "Read the rest" to open a long answer, or the candidate\'s name to go to their page.':
    'Toca “Leer el resto” para abrir una respuesta larga, o el nombre del candidato para ir a su página.',
  'Tap "Reply" to answer a comment in its thread. The up and down arrows rank comments under "Best", and tapping your arrow again takes it back.':
    'Toca “Responder” para contestar un comentario en su hilo. Las flechas hacia arriba y hacia abajo ordenan los comentarios en “Mejores”, y tocar tu flecha otra vez quita tu voto.',
  'Tap "Settings" (the gear) for language, phone notifications, and account options. Tap "Sign out" and confirm to leave.':
    'Toca “Ajustes” (el engrane) para el idioma, las notificaciones en el teléfono y las opciones de la cuenta. Toca “Cerrar sesión” y confirma para salir.',
  'Tap "Show more" to open a long policy. Tap a link under "Receipts" to open a source, or its copy icon to copy the link.':
    'Toca “Mostrar más” para abrir una propuesta larga. Toca un enlace en “Fuentes” para abrir una fuente, o su ícono de copiar para copiar el enlace.',
  'Tap "Start verification with Didit" to check your ID and Chicago address there. Your documents go to Didit, never to the app. People under 18 are declined.':
    'Toca “Iniciar la verificación con Didit” para verificar ahí tu identificación y tu domicilio en Chicago. Tus documentos van a Didit, nunca a la app. Se rechaza a las personas menores de 18 años.',
  'Tap "Unblock" next to anyone under "Blocked users" to see their posts again.':
    'Toca “Desbloquear” junto a cualquier persona en “Usuarios bloqueados” para volver a ver sus publicaciones.',
  'Tap "Verify your residency" to have Didit check your ID. This puts you in the ward on your ID, replaces the one you picked, and counts you in verified totals.':
    'Toca “Verifica tu residencia” para que Didit revise tu identificación. Así quedas en el distrito que aparece en tu identificación, en lugar del que elegiste, y cuentas en los totales verificados.',
  'Tap "View your public page" to see it exactly as voters do.':
    'Toca “Ver tu página pública” para verla exactamente como la ven los votantes.',
  'Tap "What they say they\'re running on" to open the alderman\'s campaign card. It only appears if they are running again.':
    'Toca “Por qué dice que se postula” para abrir la tarjeta de campaña del concejal. Solo aparece si se postula otra vez.',
  'Tap "privacy policy" to see what the app stores about you before you continue.':
    'Toca “política de privacidad” para ver qué guarda la app sobre ti antes de continuar.',
  'Tap 1 to 5 on a concern to rate its priority, and tap yours again to take it back. Here the verified count includes only verified residents of this ward.':
    'Toca del 1 al 5 en una preocupación para calificar su prioridad, y toca la tuya otra vez para quitarla. Aquí el conteo verificado incluye solo a los residentes verificados de este distrito.',
  'Tap 1 to 5 on a concern\'s Minor-to-Urgent bar to rate its priority. Tap your number again to take the vote back.':
    'Toca del 1 al 5 en la barra de Leve a Urgente de una preocupación para calificar su prioridad. Toca tu número otra vez para quitar el voto.',
  'Tap Google, or Apple on iPhone and the web, to sign in with that account instead.':
    'Toca Google, o Apple en iPhone y en la web, para iniciar sesión con esa cuenta.',
  'Tap a box under the header, such as "judges" or "ward races", to jump to that section. Tap the countdown line to jump to the November ballot.':
    'Toca un recuadro bajo el encabezado, como “jueces” o “concejales”, para ir a esa sección. Toca la línea de la cuenta regresiva para ir a la boleta de noviembre.',
  'Tap a candidate\'s card to open their full card, with what they are running on, their background, their campaign site and the sources.':
    'Toca la tarjeta de un candidato para abrir su tarjeta completa, con lo que propone, su trayectoria, su sitio de campaña y las fuentes.',
  'Tap a chip under "Ratings" to read that group\'s evaluation. A red banner counts negative ratings from bar associations.':
    'Toca una etiqueta en “Calificaciones” para leer la evaluación de ese grupo. Un aviso rojo cuenta las calificaciones negativas de los colegios de abogados.',
  'Tap a concern to open it. Each row shows its ward or citywide label, its vote count, its comment count and its age.':
    'Toca una preocupación para abrirla. Cada fila muestra su etiqueta de distrito o de toda la ciudad, su número de votos, su número de comentarios y su antigüedad.',
  'Tap a concern to read it in full and comment. Tap "Show more" to load 20 more.':
    'Toca una preocupación para leerla completa y comentar. Toca “Mostrar más” para cargar 20 más.',
  'Tap a language to switch the whole app to it. This works when you\'re signed out too.':
    'Toca un idioma para cambiar toda la app a ese idioma. Funciona también sin sesión iniciada.',
  'Tap a link under "Compiled from public sources:" to see where this card\'s text came from.':
    'Toca un enlace en “Compilado de fuentes públicas:” para ver de dónde salió el texto de esta tarjeta.',
  'Tap a mayoral candidate to read their full platform and comment on any policy.':
    'Toca a un candidato a la alcaldía para leer su plataforma completa y comentar cualquier propuesta.',
  'Tap a nominee\'s card to open their full card, with what they are running on, their background, their campaign site and the sources.':
    'Toca la tarjeta de un candidato para abrir su tarjeta completa, con lo que propone, su trayectoria, su sitio de campaña y las fuentes.',
  'Tap a notification to open the exact item it is about. Opening it marks it read.':
    'Toca una notificación para abrir exactamente lo que menciona. Al abrirla, se marca como leída.',
  'Tap a number on the 1 to 5 scale, from "Minor" to "Urgent", to say how much it matters. Tap your number again to take your vote back. Signed out, a tap opens sign-in.':
    'Toca un número en la escala del 1 al 5, de “Leve” a “Urgente”, para decir cuánto importa. Toca tu número otra vez para quitar tu voto. Sin sesión iniciada, un toque abre el inicio de sesión.',
  'Tap a policy to read all of it and comment on it. There is no support or oppose vote on policies, only comments.':
    'Toca una propuesta para leerla completa y comentarla. En las propuestas no se vota a favor ni en contra, solo hay comentarios.',
  'Tap a policy under "Comments on your policies" to read its newest comments and reply.':
    'Toca una propuesta en “Comentarios en tus propuestas” para leer sus comentarios más recientes y responder.',
  'Tap a question marked "You answered" to see it with every candidate\'s answer.':
    'Toca una pregunta marcada “Respondiste” para verla con la respuesta de cada candidato.',
  'Tap a question to open the page of the official you asked, where the question and any response appear.':
    'Toca una pregunta para abrir la página del oficial al que le preguntaste, donde aparecen la pregunta y su respuesta, si la hay.',
  'Tap a race, a district number, or a ward number to see who is running. "Your ward" shows your alderman\'s record next to their challengers.':
    'Toca una contienda, un número de distrito o un número de distrito municipal para ver quién se postula. “Tu distrito” muestra el historial de tu concejal junto a sus retadores.',
  'Tap a ward number and then "Set home ward" (or "Change home ward"). The ward\'s neighborhoods appear under the grid.':
    'Toca un número de distrito y luego “Fijar distrito” (o “Cambiar de distrito”). Los vecindarios del distrito aparecen debajo de la cuadrícula.',
  'Tap an issue to read it and comment. Issues are ranked by verified residents, and ones you have commented on fold down.':
    'Toca un tema para leerlo y comentar. Los temas se ordenan según los residentes verificados, y los que ya comentaste se contraen.',
  'Tap any official to open their page, where you can rate them and ask a question.':
    'Toca a cualquier oficial para abrir su página, donde puedes calificarlo y hacerle una pregunta.',
  'Tap the "From the platform of" line to go to the candidate\'s page. The "Imported from" link opens the campaign page the policy came from.':
    'Toca la línea “De la plataforma de” para ir a la página del candidato. El enlace “Importado de” abre la página de campaña de donde salió la propuesta.',
  'Tap the "Imported from" link to see the campaign page those policies were copied from. A green note at the top also opens that page.':
    'Toca el enlace “Importado de” para ver la página de campaña de donde se copiaron esas propuestas. Una nota verde arriba también abre esa página.',
  'Tap the alderman to see their grade and ask them a question.':
    'Toca al concejal para ver su calificación y hacerle una pregunta.',
  'Tap the alderman\'s row to open their page, with the full report card and questions people asked them. Residents\' ratings and judged answers set the grade, not the app.':
    'Toca la fila del concejal para abrir su página, con la ficha de calificaciones completa y las preguntas que le hizo la gente. La calificación la fijan las calificaciones de los residentes y las respuestas evaluadas, no la app.',
  'Tap the arrow and count on someone else\'s question to join it ("I want this answered too"). Tap again to leave. Questions more people have joined count more in the answers grade.':
    'Toca la flecha y el número en la pregunta de otra persona para apoyarla (“yo también quiero que la respondan”). Toca otra vez para dejar de apoyarla. Las preguntas que apoya más gente cuentan más en la calificación de respuestas.',
  'Tap the arrow and count to join the question ("I want this answered too"), and tap again to leave. You cannot join a question you asked.':
    'Toca la flecha y el número para apoyar la pregunta (“yo también quiero que la respondan”), y toca otra vez para dejar de apoyarla. No puedes apoyar una pregunta que hiciste tú.',
  'Tap the flag icon on a post or comment to report it, or to block its author so you stop seeing their content.':
    'Toca el ícono de bandera en una publicación o comentario para reportarlo, o para bloquear a su autor y dejar de ver su contenido.',
  'Tap the flag icon to report the concern or block its author. Tap the share icon to send a web link that anyone can open.':
    'Toca el ícono de bandera para reportar la preocupación o bloquear a su autor. Toca el ícono de compartir para enviar un enlace web que cualquiera puede abrir.',
  'Tap the flag icon to report the policy or a comment, or to block its author. Tap the share icon to send a web link.':
    'Toca el ícono de bandera para reportar la propuesta o un comentario, o para bloquear a su autor. Toca el ícono de compartir para enviar un enlace web.',
  'Tap the flag icon to report the question or block its asker. Tap the share icon to send a web link.':
    'Toca el ícono de bandera para reportar la pregunta o bloquear a quien la hizo. Toca el ícono de compartir para enviar un enlace web.',
  'Tap the info icon at the bottom to read what verified means and what Didit shares with the app.':
    'Toca el ícono de información abajo para leer qué significa estar verificado y qué comparte Didit con la app.',
  'Tap the info icon by "Answers" to see how grading works, or a vote under "Voting record" to see it at the Clerk. The flag icon reports or blocks, and the share icon sends a web link.':
    'Toca el ícono de información junto a “Respuestas” para ver cómo se califica, o una votación en “Historial de votos” para verla en el sitio del Secretario Municipal. El ícono de bandera reporta o bloquea, y el ícono de compartir envía un enlace web.',
  'Tap the orange "AI summary" bar to read what the platform proposes and how it compares with the other candidates. Every candidate\'s summary uses the same prompt, written from the policies listed.':
    'Toca la barra naranja “Resumen de IA” para leer lo que propone la plataforma y cómo se compara con los demás candidatos. El resumen de cada candidato usa las mismas instrucciones y se escribe a partir de las propuestas de la lista.',
  'Tap the share icon at the top to send this race. The link opens on the web for people without the app.':
    'Toca el ícono de compartir arriba para enviar esta contienda. El enlace se abre en la web para quienes no tienen la app.',
  'Tap the share icon to send a web link to this page.':
    'Toca el ícono de compartir para enviar un enlace web a esta página.',
  'Tap the up arrow ("This answers it") or the down arrow ("This dodges it") on an answer. Tap the same arrow again to take your vote back.':
    'Toca la flecha hacia arriba (“Esto la responde”) o la flecha hacia abajo (“Esto la esquiva”) en una respuesta. Toca la misma flecha otra vez para quitar tu voto.',
  'The big board of citywide concerns, ranked by how urgent people rate them. Below it are open citywide polls from elected officials, then City Council\'s upcoming meetings and recent split votes.':
    'El tablero de preocupaciones de toda la ciudad, ordenadas según qué tan urgentes las califica la gente. Debajo están las votaciones abiertas para toda la ciudad de los oficiales electos, y luego las próximas reuniones del Concejo Municipal y sus votaciones divididas recientes.',
  'The community rules for everything posted in the app, and what happens to posts and accounts that break them.':
    'Las normas de la comunidad para todo lo que se publica en la app, y lo que pasa con las publicaciones y cuentas que las rompen.',
  'The oldest has waited {days} days. A week without a response counts as ignored.':
    'La más antigua lleva {days} días esperando. Una semana sin respuesta cuenta como ignorada.',
  'The platform is imported from their campaign site.':
    'La plataforma se importa de su sitio de campaña.',
  'The {ward} race for alderman, on the February 23, 2027 ballot.':
    'La contienda por la concejalía del {ward}, en la boleta del 23 de febrero de 2027.',
  'There is no help for this page yet.':
    'Aún no hay ayuda para esta página.',
  'They are running again.':
    'Se postula otra vez.',
  'They have not said they are running again.':
    'No ha dicho que se postule otra vez.',
  'Things sent to you, newest first: answers to your questions, comments on your posts, replies to your comments, writing credits, voting deadline reminders, and notices about verification or posting limits. Officials also get new questions here.':
    'Lo que te llega, lo más reciente primero: respuestas a tus preguntas, comentarios en tus publicaciones, respuestas a tus comentarios, créditos de autoría, recordatorios de fechas límite para votar y avisos sobre la verificación o los límites de publicación. Los oficiales también reciben aquí las preguntas nuevas.',
  'Type a new address under "Use a different address" to look up your districts again.':
    'Escribe una dirección nueva en “Usar otra dirección” para volver a buscar tus distritos.',
  'Type a question in the ask box and tap "Ask". Posting limits apply, and the line under the box says when you can ask again.':
    'Escribe una pregunta en el recuadro y toca “Preguntar”. Hay límites de publicación, y la línea bajo el recuadro dice cuándo puedes volver a preguntar.',
  'Type in "Ask every candidate at once…" and tap "Put it to the candidates". The limit is 3 a day. Tap the arrow on a question to join it, and tap again to leave.':
    'Escribe en “Pregúntales a todos los candidatos a la vez…” y toca “Enviar a los candidatos”. El límite es de 3 al día. Toca la flecha en una pregunta para apoyarla, y toca otra vez para dejar de apoyarla.',
  'Type in "Write your response…" under a question and tap "Post response". Questions are sorted by most joined. Each shows how many verified residents joined it.':
    'Escribe en “Escribe tu respuesta…” bajo una pregunta y toca “Publicar respuesta”. Las preguntas se ordenan por las que más gente apoya. Cada una muestra cuántos residentes verificados la apoyan.',
  'Type your "Email" and "Password", then tap "Enter". A new password needs at least 6 characters. Tap "Show" to see what you typed.':
    'Escribe tu “Correo electrónico” y tu “Contraseña”, y luego toca “Entrar”. Una contraseña nueva necesita al menos 6 caracteres. Toca “Mostrar” para ver lo que escribiste.',
  'Type your answer under a question and tap "Post answer". Voters see every candidate\'s answer side by side. You can revise it later with "Update answer", but it cannot be taken down.':
    'Escribe tu respuesta bajo una pregunta y toca “Publicar respuesta”. Los votantes ven la respuesta de cada candidato lado a lado. Puedes corregirla después con “Actualizar respuesta”, pero no se puede retirar.',
  'Type your home address and tap "Find my districts". If it matches, you go back to the election tab with your own races listed first.':
    'Escribe tu domicilio y toca “Buscar mis distritos”. Si coincide, vuelves a la pestaña de elecciones con tus contiendas primero.',
  'Under "Audience", choose your ward\'s residents or "Citywide (everyone)". Officials without a ward can only post citywide.':
    'En “Audiencia”, elige a los residentes de tu distrito o “Toda la ciudad (todos)”. Los oficiales sin distrito solo pueden publicar para toda la ciudad.',
  'Under "City Council", check meeting times and public comment deadlines, open agendas, tap "How to give public comment", or open a recent split vote.':
    'En “Concejo Municipal”, revisa los horarios de las reuniones y las fechas límite para comentarios públicos, abre las agendas, toca “Cómo hacer un comentario público” o abre una votación dividida reciente.',
  'Under "Phone notifications", turn on each kind you want: election reminders, answers, comments, replies, writing credits, and new questions (officials only). The first switch you turn on asks your phone for permission.':
    'En “Notificaciones en el teléfono”, activa cada tipo que quieras: recordatorios de elecciones, respuestas, comentarios, réplicas, créditos de autoría y preguntas nuevas (solo oficiales). El primer interruptor que actives le pide permiso a tu teléfono.',
  'Under a response, tap "Answered" or "Dodged" to judge it. You can switch your verdict later. The results show all users and verified residents separately.':
    'Bajo una respuesta, toca “Respondida” o “Esquivada” para juzgarla. Puedes cambiar tu veredicto después. Los resultados muestran por separado a todos los usuarios y a los residentes verificados.',
  'Under an answered question, tap "Continue the conversation" to reply to the official and other readers.':
    'Bajo una pregunta respondida, toca “Continuar la conversación” para contestarle al oficial y a otros lectores.',
  'Use the "When and where to vote" links to register, apply for or track a mail ballot, find early voting sites, or find your polling place.':
    'Usa los enlaces de “Cuándo y dónde votar” para registrarte, pedir o rastrear una boleta por correo, encontrar sitios de votación anticipada o encontrar tu lugar de votación.',
  'Verified as a resident of the {ward}.':
    'Verificado como residente del {ward}.',
  'Vote on a poll under "Citywide votes". You see the full results once you vote, and tapping your choice again takes your vote back.':
    'Vota en una votación de “Votaciones de toda la ciudad”. Ves los resultados completos al votar, y tocar tu opción otra vez quita tu voto.',
  'Vote on polls under "On the ballot" if this is your home ward. Results show after you vote. "Past votes" shows the results of closed polls.':
    'Vota en las votaciones de “En la boleta” si este es tu distrito. Los resultados aparecen después de votar. “Votaciones pasadas” muestra los resultados de las votaciones cerradas.',
  'Votes from verified residents set the order first, and votes from all users break ties.':
    'Los votos de los residentes verificados fijan el orden primero, y los votos de todos los usuarios deciden los empates.',
  'Votes you have already cast stay as they are when you change wards.':
    'Los votos que ya emitiste se quedan como están cuando cambias de distrito.',
  'Votes: {all} from all users, {verified} verified.':
    'Votos: {all} de todos los usuarios, {verified} verificados.',
  'Ward concerns: {n}.':
    'Preocupaciones del distrito: {n}.',
  'Watch for the red banner on a judge\'s card. It counts how many bar associations rated that judge negatively.':
    'Fíjate en el aviso rojo en la tarjeta de un juez. Cuenta cuántos colegios de abogados calificaron negativamente a ese juez.',
  'What direct democracy stores about you, what it never sees, who can see what, and the controls you have over your data.':
    'Lo que direct democracy guarda sobre ti, lo que nunca ve, quién puede ver qué y el control que tienes sobre tus datos.',
  'What you can do':
    'Lo que puedes hacer',
  'When moving, use an ID with your new address, or an ID plus a utility bill or bank statement from the last 3 months. Checking a bill always costs money.':
    'Al mudarte, usa una identificación con tu nueva dirección, o una identificación más un recibo de servicios o un estado de cuenta bancario de los últimos 3 meses. Verificar un recibo siempre tiene costo.',
  'When the candidate has open polls, vote in them on this page. The results show once you vote.':
    'Cuando el candidato tenga votaciones abiertas, vota en ellas en esta página. Los resultados aparecen al votar.',
  'With a home ward, find your own alderman pinned at the top under "your alderman". They also appear in the full list.':
    'Si tienes distrito, encuentras a tu concejal fijado arriba en “tu concejal”. También aparece en la lista completa.',
  'With a ward set without an ID, tap "Verify your residency" so your votes count as verified. Tap "Change home ward" to switch, until posting there locks it for a while.':
    'Con un distrito fijado sin identificación, toca “Verifica tu residencia” para que tus votos cuenten como verificados. Toca “Cambiar de distrito” para cambiarlo, hasta que publicar allí lo bloquee por un tiempo.',
  'Without a home ward, tap "Verify your residency" (with an ID) or "Set your home ward" (no ID).':
    'Sin distrito, toca “Verifica tu residencia” (con identificación) o “Fija tu distrito” (sin identificación).',
  'Without a home ward, tap "Verify your residency" (with an ID, your votes count in the verified tallies) or "Set your home ward" (no ID needed).':
    'Sin distrito, toca “Verifica tu residencia” (con identificación, tus votos cuentan en los conteos verificados) o “Fija tu distrito” (no necesitas identificación).',
  'Without verification, tap "Verify your residency" or "Set your home ward" (no ID needed). You can tap "Change home ward" until posting in that ward locks it.':
    'Sin verificación, toca “Verifica tu residencia” o “Fija tu distrito” (no necesitas identificación). Puedes tocar “Cambiar de distrito” hasta que publicar en ese distrito lo bloquee.',
  'Write a "Title" of at least 4 characters, then describe the issue under "What’s going on?" in at least 20 characters.':
    'Escribe un “Título” de al menos 4 caracteres y luego describe el problema en “¿Qué está pasando?” con al menos 20 caracteres.',
  'Write a new plank of your platform or edit one you already have. Voters respond in the comments. There is no support or oppose vote.':
    'Escribe un punto nuevo de tu plataforma o edita uno que ya tengas. Los votantes responden en los comentarios. No se vota a favor ni en contra.',
  'Write in "Add to the discussion" and tap "Post comment". Signed out, tap "Sign in to comment". The "..." button adds source links you can cite as *1.':
    'Escribe en “Súmate a la discusión” y toca “Publicar comentario”. Sin sesión iniciada, toca “Inicia sesión para comentar”. El botón “...” agrega enlaces a fuentes que puedes citar como *1.',
  'Write the "Question" in at least 10 characters. Add background, tradeoffs, or links under "Context (optional)".':
    'Escribe la “Pregunta” con al menos 10 caracteres. Agrega antecedentes, ventajas y desventajas, o enlaces en “Contexto (opcional)”.',
  'You are signed out, so there are no notifications.':
    'No has iniciado sesión, así que no hay notificaciones.',
  'You are signed out.':
    'No has iniciado sesión.',
  'You asked this.':
    'Tú hiciste esta pregunta.',
  'You have asked {n} of these questions.':
    'Has hecho {n} de estas preguntas.',
  'You have no home ward yet.':
    'Aún no tienes distrito.',
  'You have no notifications yet.':
    'Aún no tienes notificaciones.',
  'You haven’t voted on it.':
    'No has votado en esto.',
  'You posted this.':
    'Tú publicaste esto.',
  'Your alderman: {name}.':
    'Tu concejal: {name}.',
  'Your display name, whether you are verified, your home ward, and counts of your concerns, comments, votes, and judgments. Officials and candidates also see their public card as voters see it.':
    'Tu nombre visible, si estás verificado, tu distrito y el número de tus preocupaciones, comentarios, votos y veredictos. Los oficiales y candidatos también ven su tarjeta pública como la ven los votantes.',
  'Your district numbers for races that depend on your street address, not just your ward. That covers US House, Illinois Senate and House, Cook County Commissioner, Board of Review, judicial subcircuit, school board and police district.':
    'Tus números de distrito para las contiendas que dependen de tu dirección, no solo de tu distrito municipal. Eso incluye la Cámara de Representantes de EE. UU., el Senado y la Cámara de Illinois, el Comisionado del Condado de Cook, la Junta de Revisión, el subcircuito judicial, el consejo escolar y el distrito policial.',
  'Your home ward: the {ward}, set without an ID.':
    'Tu distrito: el {ward}, fijado sin identificación.',
  'Your home ward: the {ward}, verified.':
    'Tu distrito: el {ward}, verificado.',
  'Your next two ballots, each in its own color band. The red bands hold the February 23, 2027 races: mayor, questions put to every mayoral candidate, and the ward races. The blue band holds the November 3 ballot: your races, how to vote, and every state, county, school board, judge, and district race.':
    'Tus próximas dos boletas, cada una en su propia franja de color. Las franjas rojas tienen las contiendas del 23 de febrero de 2027: alcaldía, preguntas a todos los candidatos a la alcaldía y las contiendas de concejales. La franja azul tiene la boleta del 3 de noviembre: tus contiendas, cómo votar y cada contienda estatal, del condado, del consejo escolar, judicial y por distrito.',
  'Your profile is not claimed yet.':
    'Tu perfil aún no está reclamado.',
  'Your races are listed first, from your address in the {ward}.':
    'Tus contiendas aparecen primero, según tu dirección en el {ward}.',
  'Your record: concerns {concerns}, comments {comments}, votes {votes}, judgments {judgments}.':
    'Tu historial: preocupaciones {concerns}, comentarios {comments}, votos {votes}, veredictos {judgments}.',
  'Your settings: language, phone notifications, verification and moving, privacy, deleting your account, and the community rules.':
    'Tus ajustes: idioma, notificaciones en el teléfono, verificación y mudanza, privacidad, eliminar tu cuenta y las normas de la comunidad.',
  'Your vote: {n}.':
    'Tu voto: {n}.',
  'Your work as a candidate: "ask every candidate" questions you haven\'t answered, the latest comments on your policies, your public card, and your platform.':
    'Tu trabajo como candidato: las preguntas de “pregunta a todos” que aún no respondes, los comentarios más recientes en tus propuestas, tu tarjeta pública y tu plataforma.',
  'Your work as an official: residents\' questions waiting for your response, your polls, the issues people are raising in your ward (or citywide), and your public card.':
    'Tu trabajo como oficial: las preguntas de los residentes que esperan tu respuesta, tus votaciones, los temas que plantea la gente en tu distrito (o en toda la ciudad) y tu tarjeta pública.',
  '{place}, posted by {name} {ago}.':
    '{place}, publicado por {name} {ago}.',
  '“{title}”, from the platform of {name}.':
    '“{title}”, de la plataforma de {name}.',
};
