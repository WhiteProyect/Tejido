// Textos de Terminos y condiciones (#terminos) y Politica de privacidad (#privacidad), que pinta
// screens/LegalScreen.jsx. Describen lo que TEJIDO hace HOY: si cambia algo de lo que se cuenta aqui
// (datos que se guardan, servicios externos, reglas de publicacion), se actualiza el texto y la
// fecha de LEGAL_UPDATED.
//
// Cada documento: { eyebrow, title, intro, sections: [{ id, title, body }] }; body es JSX.

// Fecha de la ultima actualizacion de los dos textos (AAAA-MM-DD).
export const LEGAL_UPDATED = '2026-10-26';

const P = 'm-0 text-[17px] leading-[1.75] text-[#3f514a]';
const UL = 'm-0 grid list-disc gap-2 pl-6 text-[17px] leading-[1.7] text-[#3f514a] marker:text-river';
const LINK = 'font-bold text-river underline decoration-[rgba(29,143,163,.35)] underline-offset-4 hover:decoration-river focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const contact = <a className={LINK} href="#nosotros">formulario de contacto de Nosotros</a>;

export const TERMS = {
  eyebrow: 'Legal',
  title: 'Términos y condiciones',
  intro: 'Las reglas para usar TEJIDO, escritas para que se entiendan. Al navegar o crear una cuenta, aceptas estos términos.',
  sections: [
    {
      id: 'que-es',
      title: 'Qué es TEJIDO',
      body: (
        <p className={P}>
          TEJIDO es un portal cultural y turístico de Caucasia y el Bajo Cauca antioqueño. Reúne historias, eventos,
          oportunidades, lugares, talento y a las personas y colectivos que mueven la cultura del territorio. Lo hace un
          equipo local; no cobra por usarlo y no vende nada dentro del sitio.
        </p>
      ),
    },
    {
      id: 'quien-puede-usarlo',
      title: 'Quién puede usarlo',
      body: (
        <>
          <p className={P}>Cualquier persona puede ver el contenido público sin crear una cuenta.</p>
          <p className={P}>
            Para crear una cuenta debes ser mayor de edad. Si eres menor, úsala con el acompañamiento de un adulto
            responsable. Te pedimos datos verdaderos: tu nombre y un correo que sea tuyo.
          </p>
        </>
      ),
    },
    {
      id: 'cuentas-y-roles',
      title: 'Cuentas y roles',
      body: (
        <>
          <p className={P}>En TEJIDO hay cuatro maneras de participar:</p>
          <ul className={UL}>
            <li><strong>Ciudadano:</strong> navega, guarda publicaciones, edita su perfil y puede pedir participar en una rama cultural.</li>
            <li><strong>Gestor:</strong> persona o colectivo que publica en su rama cultural y tiene un perfil público. Se llega por invitación del equipo o porque se aprobó su solicitud para participar en una rama.</li>
            <li><strong>Gestor líder:</strong> el gestor que el equipo nombra para coordinar una rama. Revisa lo que publican los participantes de su rama y decide quién se suma a ella.</li>
            <li><strong>Administrador:</strong> el equipo de TEJIDO. Revisa y modera todo el contenido y gestiona las cuentas de gestores.</li>
          </ul>
          <p className={P}>
            Tu cuenta es personal. Cuida tu contraseña y no la compartas: lo que se haga con tu sesión cuenta como hecho por ti.
          </p>
        </>
      ),
    },
    {
      id: 'publicacion-y-moderacion',
      title: 'Publicación y moderación',
      body: (
        <ul className={UL}>
          <li>Los gestores publican solo en su rama cultural.</li>
          <li>Nada sale al público sin revisión: lo que publica un participante lo revisa el líder de su rama, y lo que publica un líder, el equipo de TEJIDO. Si la rama no tiene líder, revisa el equipo.</li>
          <li>Editar una publicación que ya estaba visible la devuelve a revisión hasta que se apruebe de nuevo.</li>
          <li>Quien revisa puede aprobar o devolver una publicación con un motivo. El equipo puede retirar contenido que incumpla estas reglas, aunque ya esté publicado.</li>
          <li>Cualquier persona con cuenta puede reportar una publicación; el equipo revisa cada reporte.</li>
        </ul>
      ),
    },
    {
      id: 'sello-verificado',
      title: 'El sello «Verificado por Tejido»',
      body: (
        <p className={P}>
          Si un perfil de talento muestra el sello «Verificado por Tejido», es porque el equipo comprobó que la persona o
          el colectivo existe y es quien dice ser. El sello lo otorga y lo puede retirar el equipo. No es una garantía de la
          calidad, el precio ni el cumplimiento de un servicio que contrates con ese talento.
        </p>
      ),
    },
    {
      id: 'uso-aceptable',
      title: 'Uso aceptable',
      body: (
        <>
          <p className={P}>En TEJIDO no se permite:</p>
          <ul className={UL}>
            <li>Publicar información falsa o engañosa, o hacerse pasar por otra persona, colectivo o institución.</li>
            <li>Contenido ofensivo, discriminatorio, violento, sexual explícito o que acose a alguien.</li>
            <li>Publicar datos personales de otras personas sin su permiso.</li>
            <li>Usar fotos, textos o música de otros sin tener derecho a hacerlo.</li>
            <li>Usar el sitio para fines ilegales, para spam o para intentar entrar en cuentas o sistemas ajenos.</li>
          </ul>
          <p className={P}>Si alguien incumple estas reglas, el equipo puede retirar su contenido y desactivar su cuenta.</p>
        </>
      ),
    },
    {
      id: 'tu-contenido',
      title: 'Tu contenido',
      body: (
        <p className={P}>
          Lo que publicas sigue siendo tuyo: textos, fotos y demás material. Al publicarlo en TEJIDO nos permites
          mostrarlo dentro de la plataforma y en los enlaces que se compartan de ella, mientras esté publicado. Puedes
          editarlo o pedir que lo retiremos. Si publicas algo de otra persona, debes tener su permiso.
        </p>
      ),
    },
    {
      id: 'colaborador-y-puntos',
      title: 'Programa de colaborador y puntos',
      body: (
        <p className={P}>
          Quien tiene cuenta puede sumar puntos por colaborar, por ejemplo al compartir publicaciones. Los puntos son un
          juego para reconocer a quien mueve la cultura: no tienen valor en dinero, no se pueden vender ni cambiar por
          dinero y el equipo puede ajustar o terminar el programa. Si en algún momento hay recompensas, dependen de su
          disponibilidad.
        </p>
      ),
    },
    {
      id: 'acuerdos-entre-usuarios',
      title: 'Acuerdos entre usuarios',
      body: (
        <p className={P}>
          TEJIDO conecta a la gente con quienes hacen cultura. Si contratas a un artista, un gestor o un talento que
          encontraste aquí, el acuerdo es entre ustedes: TEJIDO no es parte de él, no cobra comisiones, no recibe ni
          intermedia pagos y no responde por lo que se acuerde. En el sitio no se hacen pagos.
        </p>
      ),
    },
    {
      id: 'disponibilidad',
      title: 'Disponibilidad del servicio',
      body: (
        <p className={P}>
          Hacemos lo posible para que TEJIDO funcione bien y la información sea correcta, pero el sitio se ofrece tal como
          está: puede haber interrupciones, errores o datos que cambien (la fecha de un evento, por ejemplo). Ante una
          decisión importante, confirma con quien organiza.
        </p>
      ),
    },
    {
      id: 'cambios',
      title: 'Cambios a estos términos',
      body: (
        <p className={P}>
          Si cambiamos estos términos, publicaremos aquí la nueva versión con su fecha de actualización. Si el cambio es
          importante, lo avisaremos también en el sitio o por correo a quienes tienen cuenta.
        </p>
      ),
    },
    {
      id: 'contacto',
      title: 'Contacto',
      body: <p className={P}>¿Dudas sobre estos términos? Escríbenos desde el {contact}.</p>,
    },
  ],
};

export const PRIVACY = {
  eyebrow: 'Legal',
  title: 'Política de privacidad',
  intro: 'Qué datos guarda TEJIDO, para qué los usa, con quién los comparte y cómo puedes pedir que los corrijamos o borremos.',
  sections: [
    {
      id: 'responsable',
      title: 'Quién cuida tus datos',
      body: (
        <p className={P}>
          El equipo de TEJIDO, en Caucasia (Antioquia, Colombia), es responsable de los datos que se guardan en la
          plataforma. Para cualquier tema de privacidad, escríbenos desde el {contact}.
        </p>
      ),
    },
    {
      id: 'datos',
      title: 'Qué datos recogemos',
      body: (
        <>
          <ul className={UL}>
            <li><strong>Tu cuenta:</strong> nombre, correo y contraseña. La contraseña nunca se guarda tal cual: guardamos solo una huella cifrada (hash con sal) que no permite recuperarla.</li>
            <li><strong>Tu perfil:</strong> la foto que decidas subir.</li>
            <li><strong>Si eres gestor:</strong> los datos de tu perfil público que tú decides mostrar (nombre de la organización, biografía, fotos, redes y, solo si los activas, tu WhatsApp, correo o sitio web) y un contacto privado que solo ve el equipo.</li>
            <li><strong>Lo que publicas:</strong> textos, fotos y demás contenido de tus publicaciones.</li>
            <li><strong>Lo que nos escribes:</strong> los mensajes del formulario de Nosotros, con el nombre y el contacto que quieras dejar.</li>
            <li><strong>Lo que haces con tu cuenta:</strong> las publicaciones que guardas, tus solicitudes para participar en una rama, los reportes que envías y los puntos del programa de colaborador.</li>
          </ul>
          <p className={P}>No pedimos datos de pago (en TEJIDO no se paga nada) ni guardamos tu ubicación.</p>
        </>
      ),
    },
    {
      id: 'para-que',
      title: 'Para qué los usamos',
      body: (
        <ul className={UL}>
          <li>Para que tengas una cuenta, iniciar tu sesión y mostrarte lo que te corresponde según tu rol.</li>
          <li>Para mostrar en el sitio el contenido público: publicaciones, perfiles de gestores, artistas y talento.</li>
          <li>Para revisar y moderar lo que se publica y atender reportes y mensajes.</li>
          <li>Para enviarte correos sobre tu cuenta y tu actividad: invitaciones, avisos de revisión o de aprobación y respuestas a tus solicitudes. No te enviamos publicidad sin tu permiso.</li>
        </ul>
      ),
    },
    {
      id: 'terceros',
      title: 'Servicios externos que usamos',
      body: (
        <>
          <p className={P}>Para funcionar, TEJIDO se apoya en tres servicios que procesan datos por nosotros:</p>
          <ul className={UL}>
            <li><strong>Neon (PostgreSQL):</strong> la base de datos donde se guardan las cuentas y el contenido.</li>
            <li><strong>Cloudinary:</strong> guarda y entrega las imágenes que se suben al sitio.</li>
            <li><strong>Resend:</strong> envía los correos de la plataforma (invitaciones y avisos).</li>
          </ul>
          <p className={P}>Solo reciben lo necesario para hacer su trabajo.</p>
        </>
      ),
    },
    {
      id: 'lo-que-no-hacemos',
      title: 'Lo que no hacemos',
      body: (
        <ul className={UL}>
          <li>No vendemos tus datos ni los compartimos con anunciantes.</li>
          <li>No mostramos publicidad de terceros.</li>
          <li>No usamos herramientas de rastreo de terceros.</li>
        </ul>
      ),
    },
    {
      id: 'proteccion',
      title: 'Cómo los protegemos',
      body: (
        <ul className={UL}>
          <li>Las contraseñas se guardan solo como huella cifrada (hash con sal), nunca en texto plano.</li>
          <li>Tu sesión funciona con una clave temporal que vence sola y que se borra cuando cierras sesión.</li>
          <li>Cada rol solo ve lo que le corresponde, y el contacto privado de los gestores nunca se muestra en público.</li>
          <li>La conexión con la base de datos va cifrada.</li>
        </ul>
      ),
    },
    {
      id: 'navegador',
      title: 'Lo que se guarda en tu navegador',
      body: (
        <p className={P}>
          TEJIDO no usa cookies de publicidad ni de rastreo. Usa el almacenamiento local de tu navegador solo para
          mantener tu sesión abierta, para tu «pasaporte» de municipios visitados y para devolverte a la página donde
          estabas después de iniciar sesión. Esos datos se quedan en tu dispositivo y puedes borrarlos desde tu navegador.
        </p>
      ),
    },
    {
      id: 'tus-derechos',
      title: 'Tus derechos',
      body: (
        <>
          <p className={P}>
            Conforme a la ley colombiana de protección de datos (Ley 1581 de 2012), puedes conocer los datos que tenemos
            de ti, actualizarlos, corregirlos y pedir que los borremos.
          </p>
          <p className={P}>
            Tu nombre y tu foto los cambias tú mismo desde tu perfil; un gestor también edita ahí su perfil público. Para
            todo lo demás, incluido borrar tu cuenta, escríbenos desde el {contact} y te responderemos.
          </p>
        </>
      ),
    },
    {
      id: 'conservacion',
      title: 'Cuánto tiempo los guardamos',
      body: (
        <p className={P}>
          Guardamos tus datos mientras tengas una cuenta o mientras hagan falta para operar la plataforma. Si pides
          borrarlos, los eliminamos, salvo lo que la ley nos obligue a conservar.
        </p>
      ),
    },
    {
      id: 'menores',
      title: 'Menores de edad',
      body: (
        <p className={P}>
          Las cuentas de TEJIDO son para personas mayores de edad. Si eres menor, úsala con el acompañamiento de un adulto
          responsable. Si sabes que un menor creó una cuenta sin ese acompañamiento, escríbenos y lo revisaremos.
        </p>
      ),
    },
    {
      id: 'cambios',
      title: 'Cambios a esta política',
      body: (
        <p className={P}>
          Si cambiamos esta política, publicaremos aquí la nueva versión con su fecha de actualización. Si el cambio afecta
          cómo usamos tus datos, lo avisaremos también en el sitio o por correo a quienes tienen cuenta.
        </p>
      ),
    },
  ],
};
