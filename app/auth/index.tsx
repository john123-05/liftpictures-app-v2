import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, User, ArrowLeft, AlertCircle, ChevronDown, Check } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

type Park = {
  id: string;
  name: string;
  slug: string;
};

type MembershipPark = {
  park_id: string;
  name: string;
  slug: string;
};

const readSearchParam = (value?: string | string[]) => {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
};

export default function AuthScreen() {
  const params = useLocalSearchParams<{ redirectTo?: string | string[]; mode?: string | string[] }>();
  const modeParam = readSearchParam(params.mode);
  const redirectTarget = useMemo(() => {
    const raw = readSearchParam(params.redirectTo);
    if (!raw) return '/(tabs)';

    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }

    return decoded.startsWith('/') ? decoded : '/(tabs)';
  }, [params.redirectTo]);

  const [isSignUp, setIsSignUp] = useState(modeParam === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedParkId, setSelectedParkId] = useState<string>('');
  const [loadingParks, setLoadingParks] = useState(false);
  const [showParkModal, setShowParkModal] = useState(false);
  const [showLoginParkModal, setShowLoginParkModal] = useState(false);
  const [loginParks, setLoginParks] = useState<MembershipPark[]>([]);
  const [selectedLoginParkId, setSelectedLoginParkId] = useState<string>('');
  const { t } = useTranslation();

  const { signIn, signUp, signOut, user, loading: authLoading, switchPark } = useAuthContext();

  useEffect(() => {
    if (modeParam === 'signup') {
      setIsSignUp(true);
      return;
    }

    if (modeParam === 'signin') {
      setIsSignUp(false);
    }
  }, [modeParam]);

  useEffect(() => {
    const loadParks = async () => {
      setLoadingParks(true);
      try {
        const { data, error } = await supabase
          .from('parks')
          .select('id, name, slug')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) throw error;

        const loadedParks = (data || []) as Park[];
        setParks(loadedParks);
        if (loadedParks.length > 0) {
          const adventure = loadedParks.find((park) => park.slug === 'adventure-land');
          const defaultParkId = (adventure || loadedParks[0]).id;
          setSelectedParkId((prev) => prev || defaultParkId);
        }
      } catch (err) {
        console.error('Error loading parks:', err);
      } finally {
        setLoadingParks(false);
      }
    };

    loadParks();
  }, []);

  useEffect(() => {
    // Navigate only after auth context confirms a logged-in user.
    if (!isSignUp && !authLoading && !isLoading && user && !showLoginParkModal) {
      router.replace(redirectTarget);
    }
  }, [isSignUp, authLoading, isLoading, user, showLoginParkModal, redirectTarget]);

  const handleAuth = async () => {
    setError('');
    setSuccessMessage('');

    if (!email || !password || (isSignUp && (!firstName || !lastName))) {
      setError(t('auth.errors.fillAllFields'));
      return;
    }

    if (isSignUp && !selectedParkId) {
      setError(t('auth.errors.selectParkRequired'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.errors.passwordTooShort'));
      return;
    }

    setIsLoading(true);

    try {
      let result;

      if (isSignUp) {
        console.log('Attempting sign up with:', { email, firstName, lastName });
        result = await signUp(email, password, firstName, lastName, selectedParkId);

        if (!result.error && result?.existingUserLinkedPark) {
          setSuccessMessage('Park erfolgreich mit deinem bestehenden Konto verknüpft.');
          setTimeout(() => router.replace(redirectTarget), 900);
        } else if (!result.error) {
          setSuccessMessage(t('auth.signupSuccess'));
          setEmail('');
          setPassword('');
          setFirstName('');
          setLastName('');
          if (parks.length > 0) {
            const adventure = parks.find((park) => park.slug === 'adventure-land');
            setSelectedParkId((adventure || parks[0]).id);
          }
          setTimeout(() => setIsSignUp(false), 3000);
        }
      } else {
        console.log('Attempting sign in with:', { email });
        result = await signIn(email, password);

        if (!result?.error && result?.requiresParkSelection) {
          const availableParks = (result.parks || []) as MembershipPark[];
          setLoginParks(availableParks);
          setSelectedLoginParkId(availableParks[0]?.park_id || '');
          setShowLoginParkModal(true);
        }
      }

      console.log('Auth result:', result);

      if (result.error) {
        console.error('Auth error:', result.error);
        let errorMessage = t('auth.errors.authFailed');

        if (result.error.message?.includes('Invalid login credentials')) {
          errorMessage = t('auth.errors.invalidCredentials');
        } else if (result.error.message?.includes('Email not confirmed')) {
          errorMessage = t('auth.errors.emailNotConfirmed');
        } else if (result.error.message?.includes('User already registered')) {
          errorMessage = t('auth.errors.emailAlreadyRegistered');
        } else if (result.error.message?.includes('Selected park is not linked')) {
          errorMessage = 'Dieser Park ist nicht mit deinem Konto verknüpft.';
        } else {
          errorMessage = result.error.message || errorMessage;
        }

        setError(errorMessage);
      }
    } catch (error) {
      console.error('Unexpected auth error:', error);
      setError(t('auth.errors.unexpected'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmLoginPark = async () => {
    if (!selectedLoginParkId) return;

    setIsLoading(true);
    setError('');
    try {
      // Re-auth with explicit preferred park to avoid session timing issues.
      const reSignInResult = await signIn(email, password, selectedLoginParkId);
      if (reSignInResult?.error) {
        throw reSignInResult.error;
      }

      // Safety fallback in case backend accepted login but park switch was not persisted.
      const switchResult = await switchPark(selectedLoginParkId);
      if (!switchResult.success) {
        console.warn('Park switch fallback warning:', switchResult.error);
      }

      setShowLoginParkModal(false);
    } catch (error: any) {
      setError(error?.message || 'Parkauswahl konnte nicht gespeichert werden.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelLoginPark = async () => {
    setShowLoginParkModal(false);
    setLoginParks([]);
    setSelectedLoginParkId('');
    await signOut();
  };

  const handleBack = () => {
    router.replace('/');
  };

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />

        <LinearGradient
          colors={['#000', '#1a1a1a']}
          style={styles.gradient}
        >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.logo}>Liftpictures</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>
              {isSignUp ? t('auth.createAccount') : t('auth.signIn')}
            </Text>
            <Text style={styles.authSubtitle}>
              {isSignUp 
                ? t('auth.createAccountSubtitle')
                : t('auth.signInSubtitle')
              }
            </Text>

            {error ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#ff4757" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successContainer}>
                <AlertCircle size={16} color="#00c851" />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}
            <View style={styles.form}>
              {isSignUp && (
                <>
                  <View style={styles.inputGroup}>
                    <View style={styles.inputIcon}>
                      <User size={20} color="#999" />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder={t('auth.firstName')}
                      placeholderTextColor="#666"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <View style={styles.inputIcon}>
                      <User size={20} color="#999" />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder={t('auth.lastName')}
                      placeholderTextColor="#666"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.inputGroup}
                    onPress={() => setShowParkModal(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.inputIcon}>
                      <User size={20} color="#999" />
                    </View>
                    <View style={styles.parkPickerContent}>
                      <Text style={styles.parkPickerLabel}>{t('auth.park')}</Text>
                      <Text style={styles.parkPickerValue}>
                        {loadingParks
                          ? t('auth.loadingParks')
                          : parks.find((park) => park.id === selectedParkId)?.name || t('auth.selectPark')}
                      </Text>
                    </View>
                    {loadingParks ? (
                      <ActivityIndicator size="small" color="#999" />
                    ) : (
                      <ChevronDown size={18} color="#999" />
                    )}
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <Mail size={20} color="#999" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.emailAddress')}
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <Lock size={20} color="#999" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.password')}
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.authButton, isLoading && styles.authButtonLoading]}
                onPress={handleAuth}
                disabled={isLoading}
              >
                <Text style={styles.authButtonText}>
                  {isLoading 
                    ? t('common.loading')
                    : isSignUp 
                      ? t('auth.createAccount')
                      : t('auth.signIn')
                  }
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('common.or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsSignUp(!isSignUp)}
            >
              <Text style={styles.switchText}>
                {isSignUp 
                  ? t('auth.haveAccountPrompt')
                  : t('auth.noAccountPrompt')
                }
                <Text style={styles.switchLink}>
                  {isSignUp ? t('auth.signIn') : t('auth.register')}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('auth.termsPrefix')}{'\n'}
            <Text style={styles.footerLink}>{t('auth.terms')}</Text> {t('auth.andThe')}{' '}
            <Text style={styles.footerLink}>{t('auth.privacyPolicy')}</Text> {t('auth.termsSuffix')}
          </Text>
        </View>
      </LinearGradient>
      </SafeAreaView>

      <Modal visible={showParkModal} transparent animationType="slide" onRequestClose={() => setShowParkModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('auth.selectPark')}</Text>
            {parks.map((park) => (
              <TouchableOpacity
                key={park.id}
                style={styles.parkOption}
                onPress={() => {
                  setSelectedParkId(park.id);
                  setShowParkModal(false);
                }}
              >
                <Text style={styles.parkOptionText}>{park.name}</Text>
                {selectedParkId === park.id ? <Check size={18} color="#ff6b35" /> : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeModalButton} onPress={() => setShowParkModal(false)}>
              <Text style={styles.closeModalButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLoginParkModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancelLoginPark}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Du bist bei mehreren Parks registriert</Text>
            <Text style={styles.loginParkSubtitle}>Bitte wähle den Park für diese Anmeldung.</Text>
            {loginParks.map((park) => (
              <TouchableOpacity
                key={park.park_id}
                style={styles.parkOption}
                onPress={() => setSelectedLoginParkId(park.park_id)}
              >
                <Text style={styles.parkOptionText}>{park.name}</Text>
                {selectedLoginParkId === park.park_id ? <Check size={18} color="#ff6b35" /> : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.authButton, isLoading && styles.authButtonLoading, { marginTop: 14 }]}
              onPress={handleConfirmLoginPark}
              disabled={isLoading || !selectedLoginParkId}
            >
              <Text style={styles.authButtonText}>
                {isLoading ? t('common.loading') : t('auth.signIn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeModalButton} onPress={handleCancelLoginPark} disabled={isLoading}>
              <Text style={styles.closeModalButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#000',
    ...(Platform.OS === 'web' ? {
      maxWidth: 428,
      marginHorizontal: 'auto',
      width: '100%',
    } : {}),
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6b35',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  authCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 16,
  },
  parkPickerContent: {
    flex: 1,
    paddingVertical: 10,
  },
  parkPickerLabel: {
    color: '#777',
    fontSize: 12,
    marginBottom: 2,
  },
  parkPickerValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  authButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  authButtonLoading: {
    backgroundColor: '#cc5429',
  },
  authButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#666',
  },
  switchButton: {
    alignItems: 'center',
  },
  switchText: {
    fontSize: 16,
    color: '#999',
  },
  switchLink: {
    color: '#ff6b35',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: '#ff6b35',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a1a1a',
    borderColor: '#ff4757',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#ff4757',
    marginLeft: 8,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2a1a',
    borderColor: '#00c851',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
    color: '#00c851',
    marginLeft: 8,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  parkOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2d',
  },
  parkOptionText: {
    color: '#fff',
    fontSize: 15,
  },
  closeModalButton: {
    marginTop: 14,
    backgroundColor: '#2b2b2b',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#ddd',
    fontSize: 15,
    fontWeight: '600',
  },
  loginParkSubtitle: {
    color: '#aaa',
    marginBottom: 10,
    fontSize: 14,
  },
});
