import ExploreSection from '../components/ExploreSection.jsx';

export default function ExploreScreen({ publications = [], loading = false, error = '', user }) {
  return <ExploreSection publications={publications} loading={loading} error={error} user={user} />;
}
