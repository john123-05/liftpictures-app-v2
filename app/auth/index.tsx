import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, User, ArrowLeft, AlertCircle } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { signIn, signUp } = useAuthContext();

  const handleAuth = async () => {
    setError('');
    setSuccessMessage('');

    if (!email || !password || (isSignUp && (!firstName || !lastName))) {
      setError('Bitte fülle alle Felder aus.');
      return;
    }

    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setIsLoading(true);

    try {
      let result;

      if (isSignUp) {
        console.log('Attempting sign up with:', { email, firstName, lastName });
        result = await signUp(email, password, firstName, lastName);

        if (!result.error) {
          setSuccessMessage('Registrierung erfolgreich! Bitte überprüfe deine E-Mail, um dein Konto zu bestätigen.');
          setEmail('');
          setPassword('');
          setFirstName('');
          setLastName('');
          setTimeout(() => setIsSignUp(false), 3000);
        }
      } else {
        console.log('Attempting sign in with:', { email });
        result = await signIn(email, password);

        if (!result.error) {
          console.log('Auth successful, redirecting...');
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 100);
        }
      }

      console.log('Auth result:', result);

      if (result.error) {
        console.error('Auth error:', result.error);
        let errorMessage = 'Authentifizierung fehlgeschlagen';

        if (result.error.message?.includes('Invalid login credentials')) {
          errorMessage = 'Ungültige E-Mail oder Passwort';
        } else if (result.error.message?.includes('Email not confirmed')) {
          errorMessage = 'Bitte bestätige zuerst deine E-Mail-Adresse';
        } else if (result.error.message?.includes('User already registered')) {
          errorMessage = 'Diese E-Mail-Adresse ist bereits registriert';
        } else {
          errorMessage = result.error.message || errorMessage;
        }

        setError(errorMessage);
      }
    } catch (error) {
      console.error('Unexpected auth error:', error);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
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
              {isSignUp ? 'Konto erstellen' : 'Anmelden'}
            </Text>
            <Text style={styles.authSubtitle}>
              {isSignUp 
                ? 'Erstelle ein Konto für alle deine Fahrten' 
                : 'Melde dich an, um deine Bilder zu sehen'
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
                      placeholder="Vorname"
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
                      placeholder="Nachname"
                      placeholderTextColor="#666"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </View>
                </>
              )}

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <Mail size={20} color="#999" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="E-Mail-Adresse"
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
                  placeholder="Passwort"
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
                    ? 'Lädt...' 
                    : isSignUp 
                      ? 'Konto erstellen' 
                      : 'Anmelden'
                  }
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>oder</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsSignUp(!isSignUp)}
            >
              <Text style={styles.switchText}>
                {isSignUp 
                  ? 'Hast du bereits ein Konto? ' 
                  : 'Noch kein Konto? '
                }
                <Text style={styles.switchLink}>
                  {isSignUp ? 'Anmelden' : 'Registrieren'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Mit der Anmeldung stimmst du unseren{'\n'}
            <Text style={styles.footerLink}>Nutzungsbedingungen</Text> und der{' '}
            <Text style={styles.footerLink}>Datenschutzerklärung</Text> zu.
          </Text>
        </View>
      </LinearGradient>
      </SafeAreaView>
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
});