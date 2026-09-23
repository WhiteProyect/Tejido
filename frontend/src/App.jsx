import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Footer from './components/Footer.jsx';
import HiloAssistant from './components/HiloAssistant.jsx';
import SiteHeader from './components/SiteHeader.jsx';
import AgendaScreen from './screens/AgendaScreen.jsx';
import ArtistScreen from './screens/ArtistScreen.jsx';
import ArtistDashboard from './screens/ArtistDashboard.jsx';
import ArtistMediaKit from './screens/ArtistMediaKit.jsx';
import ExploreScreen from './screens/ExploreScreen.jsx';
import HomeScreen from './screens/HomeScreen.jsx';
import MapScreen from './screens/MapScreen.jsx';
import MoneystackScreen from './screens/MoneystackScreen.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import NosotrosScreen from './screens/NosotrosScreen.jsx';
import NotFoundScreen from './screens/NotFoundScreen.jsx';
import OpportunitiesScreen from './screens/OpportunitiesScreen.jsx';
import ProfileScreen from './screens/ProfileScreen.jsx';
import SavedScreen from './screens/SavedScreen.jsx';
import TalentScreen from './screens/TalentScreen.jsx';

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('No fue posible cargar los contenidos');
  return response.json();
}

function getRoute() {
  const path = window.location.pathname;
  const hash = window.location.hash.replace('#', '') || '';

  if (path.startsWith('/artistas/')) {
    const slug = path.split('/artistas/')[1]?.split('/')[0];
    const rest = path.split('/artistas/')[1] || '';
    if (rest.includes('/media-kit')) return { screen: 'media-kit', slug };
    if (rest.includes('/dashboard')) return { screen: 'dashboard', slug };
    return { screen: 'artist', slug };
  }

  if (hash.startsWith('artista/')) {
    const slug = hash.split('/')[1] || 'og-mauro';
    if (hash.includes('/media-kit')) return { screen: 'media-kit', slug };
    if (hash.includes('/dashboard')) return { screen: 'dashboard', slug };
    return { screen: 'artist', slug };
  }

  // La pantalla publica Colaborar se retiro (2026-09-22): los enlaces viejos van a Nosotros.
  if (hash === 'colaborador') {
    window.history.replaceState(null, '', '#nosotros');
    return { screen: 'nosotros', slug: null };
  }

  return { screen: hash || 'inicio', slug: null };
}

export default function App() {
  const [route, setRoute] = useState(getRoute);
  const [publications, setPublications] = useState([]);
  const [activeKind, setActiveKind] = useState('TODOS');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  // true cuando ya se sabe si hay sesion (sin token, de inmediato; con token, tras /api/me).
  // Evita mandar a login desde #perfil mientras la sesion todavia se esta validando.
  const [authReady, setAuthReady] = useState(() => !localStorage.getItem('tejido_token'));

  useEffect(() => {
    const handleChange = () => {
      setRoute(getRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleChange);
    window.addEventListener('popstate', handleChange);

    const token = localStorage.getItem('tejido_token');
    if (token) {
      fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (data.user) setUser(data.user);
        })
        .catch(() => {})
        .finally(() => setAuthReady(true));
    }

    getJson('/api/publications')
      .then(setPublications)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
    return () => {
      window.removeEventListener('hashchange', handleChange);
      window.removeEventListener('popstate', handleChange);
    };
  }, []);

  function handleLogin(userData) {
    setUser(userData);
    const returnTo = sessionStorage.getItem('tejido_return_to');
    if (returnTo) {
      sessionStorage.removeItem('tejido_return_to');
      window.location.hash = returnTo;
    }
  }

  // #perfil sin sesion: a Login, volviendo al perfil despues de entrar. Se mira tambien el hash
  // real: al cerrar sesion desde el perfil, handleLogout ya lo cambio a #inicio antes de que
  // llegue el hashchange, y no hay que mandar a login.
  useEffect(() => {
    if (route.screen === 'perfil' && window.location.hash === '#perfil' && authReady && !user) {
      sessionStorage.setItem('tejido_return_to', 'perfil');
      window.location.replace('#login');
    }
  }, [route.screen, authReady, user]);

  function handleLogout() {
    localStorage.removeItem('tejido_token');
    setUser(null);
    window.location.hash = 'inicio';
  }

  const isArtistRoute = route.screen === 'artist' || route.screen === 'media-kit' || route.screen === 'dashboard';
  // Login es una pantalla enfocada: sin header, footer ni Hilo (trae su propio "Volver al inicio").
  const isLoginRoute = route.screen === 'login';

  const events = publications.filter((publication) => publication.kind === 'EVENTO');
  const opportunities = publications.filter((publication) => publication.kind === 'OPORTUNIDAD');
  const talents = publications.filter((publication) => publication.kind === 'TALENTO');

  let content;
  switch (route.screen) {
    case 'artist':
      content = <ArtistScreen />;
      break;
    case 'media-kit':
      content = <ArtistMediaKit />;
      break;
    case 'dashboard':
      content = user ? <ArtistDashboard /> : <LoginScreen onSuccess={handleLogin} />;
      break;
    case 'explorar':
      content = <ExploreScreen publications={publications} activeKind={activeKind} onKindChange={setActiveKind} search={search} onSearchChange={setSearch} loading={loading} error={error} user={user} />;
      break;
    case 'mapa':
      content = <MapScreen publications={publications} />;
      break;
    case 'agenda':
      content = <AgendaScreen events={events} />;
      break;
    case 'oportunidades':
      content = <OpportunitiesScreen opportunities={opportunities} />;
      break;
    case 'talento':
      content = <TalentScreen talents={talents} />;
      break;
    case 'guardadas':
      content = <SavedScreen />;
      break;
    case 'nosotros':
      content = <NosotrosScreen />;
      break;
    case 'perfil':
      // Mientras se valida la sesion (o se redirige a login) se reserva el espacio.
      content = user ? <ProfileScreen user={user} onLogout={handleLogout} /> : <section className="min-h-[62vh]" aria-busy="true" />;
      break;
    case 'moneystack':
      content = <MoneystackScreen />;
      break;
    case 'login':
      content = <LoginScreen onSuccess={handleLogin} />;
      break;
    case 'inicio':
    default:
      content = <HomeScreen onExplore={() => { window.location.hash = 'explorar'; }} publications={publications} />;
      break;
  }

  return (
    <>
      {!isArtistRoute && (
        <>
          {!isLoginRoute && <SiteHeader user={user} isMoneystack={route.screen === 'moneystack'} onLogin={() => { sessionStorage.setItem('tejido_return_to', getRoute().screen); window.location.hash = 'login'; }} onLogout={handleLogout} />}
          <main>
            <AnimatePresence mode="wait">
              <motion.div
                key={route.screen}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                {content}
              </motion.div>
            </AnimatePresence>
          </main>
          {!isLoginRoute && <Footer />}
          {/* En inicio, HeroInteractive es la guía principal de Hilo; el asistente flotante acompaña las demás vistas (menos login). */}
          {route.screen !== 'inicio' && !isLoginRoute && <HiloAssistant publications={publications} />}
        </>
      )}
      {isArtistRoute && content}
    </>
  );
}
