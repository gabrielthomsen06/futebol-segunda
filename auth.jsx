// auth.jsx — Hook de autenticação + telas Auth e MyProfile

function useAuth() {
  const [session, setSession] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  // Boot: pega sessão atual + escuta mudanças
  React.useEffect(() => {
    let mounted = true;

    supabaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSession(sess);
      if (!sess) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Quando session muda, busca o profile correspondente
  React.useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    setLoading(true);
    fetchMyProfile(session.user.id)
      .then(p => {
        if (!cancelled) {
          setProfile(p);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const signUpWithEmail = async (email, name) => {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        data: { name },
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email) => {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabaseClient.auth.signOut();
  };

  const refreshProfile = async () => {
    if (!session?.user) return;
    const p = await fetchMyProfile(session.user.id);
    setProfile(p);
  };

  return {
    user: session?.user || null,
    profile,
    isAdmin: !!profile?.is_admin,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    refreshProfile,
  };
}

window.useAuth = useAuth;
