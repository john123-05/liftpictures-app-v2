import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

export default function EditProfileScreen() {
  const { user } = useAuthContext();
  const { t } = useTranslation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    setFirstName(user.vorname || '');
    setLastName(user.nachname || '');
    setDisplayName(user.display_name || '');
    setEmail(user.email || '');
  }, [user]);

  useEffect(() => {
    const loadLatestProfile = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !data) return;

      setFirstName(data.vorname || '');
      setLastName(data.nachname || '');
      setDisplayName(data.display_name || user.display_name || '');
      setEmail(data.email || user.email || '');
    };

    loadLatestProfile();
  }, [user?.id, user?.display_name, user?.email]);

  const requireReauthentication = async () => {
    const loginEmail = user?.email;
    if (!loginEmail) {
      throw new Error(t('editProfile.errors.noUserFound'));
    }

    if (!currentPassword.trim()) {
      throw new Error(t('editProfile.errors.enterCurrentPassword'));
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: currentPassword,
    });

    if (error) {
      throw new Error(t('editProfile.errors.currentPasswordWrong'));
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) {
      Alert.alert(t('common.error'), t('editProfile.errors.notLoggedIn'));
      return;
    }

    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const trimmedDisplay = displayName.trim();

      const { error: baseUserTableError } = await supabase
        .from('users')
        .upsert(
          {
            id: user.id,
            email: user.email,
            vorname: trimmedFirst,
            nachname: trimmedLast,
          } as any,
          { onConflict: 'id' },
        );

      if (baseUserTableError) throw baseUserTableError;

      // Optional column support: if migration is missing, keep profile save working.
      const { error: displayNameError } = await supabase
        .from('users')
        .update({ display_name: trimmedDisplay || null } as any)
        .eq('id', user.id);

      if (displayNameError && !String(displayNameError.message || '').includes('display_name')) {
        throw displayNameError;
      }

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          first_name: trimmedFirst,
          last_name: trimmedLast,
          display_name: trimmedDisplay || null,
        },
      });
      if (authUpdateError) throw authUpdateError;

      setProfileMessage(t('editProfile.messages.profileUpdated'));
      Alert.alert(t('editProfile.messages.savedTitle'), t('editProfile.messages.profileUpdated'));
    } catch (error: any) {
      setProfileMessage(error?.message || t('editProfile.errors.profileSaveFailed'));
      Alert.alert(t('common.error'), error?.message || t('editProfile.errors.profileSaveFailed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSecurity = async () => {
    if (!user?.id) {
      Alert.alert(t('common.error'), t('editProfile.errors.notLoggedIn'));
      return;
    }

    setSavingSecurity(true);
    setSecurityMessage(null);
    try {
      await requireReauthentication();

      const updatePayload: { email?: string; password?: string } = {};
      const nextEmail = email.trim();

      if (nextEmail && nextEmail !== user.email) {
        updatePayload.email = nextEmail;
      }

      if (newPassword || confirmPassword) {
        if (newPassword.length < 6) {
          throw new Error(t('editProfile.errors.newPasswordTooShort'));
        }
        if (newPassword !== confirmPassword) {
          throw new Error(t('editProfile.errors.passwordsDontMatch'));
        }
        updatePayload.password = newPassword;
      }

      if (!updatePayload.email && !updatePayload.password) {
        throw new Error(t('editProfile.errors.noSecurityChanges'));
      }

      const { error: authUpdateError } = await supabase.auth.updateUser(updatePayload);
      if (authUpdateError) throw authUpdateError;

      if (updatePayload.email) {
        const { error: userEmailError } = await supabase
          .from('users')
          .update({ email: updatePayload.email })
          .eq('id', user.id);

        if (userEmailError) throw userEmailError;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      const successMessage = updatePayload.email && updatePayload.password
        ? t('editProfile.messages.emailAndPasswordUpdated')
        : updatePayload.email
          ? t('editProfile.messages.emailUpdatedConfirm')
          : t('editProfile.messages.passwordUpdated');
      setSecurityMessage(successMessage);

      Alert.alert(
        t('editProfile.messages.securityUpdatedTitle'),
        updatePayload.email
          ? t('editProfile.messages.confirmEmailInbox')
          : t('editProfile.messages.passwordChanged'),
      );
    } catch (error: any) {
      setSecurityMessage(error?.message || t('editProfile.errors.securitySaveFailed'));
      Alert.alert(t('common.error'), error?.message || t('editProfile.errors.securitySaveFailed'));
    } finally {
      setSavingSecurity(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('editProfile.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('editProfile.accountSection')}</Text>

          <Text style={styles.label}>{t('editProfile.firstName')}</Text>
          <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder={t('editProfile.firstName')} placeholderTextColor="#666" />

          <Text style={styles.label}>{t('editProfile.lastName')}</Text>
          <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder={t('editProfile.lastName')} placeholderTextColor="#666" />

          <Text style={styles.label}>{t('editProfile.dashboardUsername')}</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder={t('editProfile.dashboardUsernamePlaceholder')} placeholderTextColor="#666" />

          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveProfile} disabled={savingProfile}>
            <Save size={18} color="#000" />
            <Text style={styles.primaryButtonText}>{savingProfile ? t('editProfile.saving') : t('editProfile.saveProfile')}</Text>
          </TouchableOpacity>
          {profileMessage ? <Text style={styles.feedbackText}>{profileMessage}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('editProfile.securitySection')}</Text>

          <Text style={styles.label}>{t('editProfile.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t('editProfile.email')}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>{t('editProfile.currentPasswordRequired')}</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder={t('editProfile.currentPassword')}
            secureTextEntry
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>{t('editProfile.newPasswordOptional')}</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('editProfile.newPassword')}
            secureTextEntry
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>{t('editProfile.repeatNewPassword')}</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('editProfile.repeatPassword')}
            secureTextEntry
            placeholderTextColor="#666"
          />

          <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveSecurity} disabled={savingSecurity}>
            <ShieldCheck size={18} color="#fff" />
            <Text style={styles.secondaryButtonText}>{savingSecurity ? t('editProfile.saving') : t('editProfile.updateEmailPassword')}</Text>
          </TouchableOpacity>
          {securityMessage ? <Text style={styles.feedbackText}>{securityMessage}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#171717',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2b2b2b',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: '#ff8c42',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#000',
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 14,
    backgroundColor: '#1f5fff',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  feedbackText: {
    marginTop: 10,
    color: '#9ad29a',
    fontSize: 13,
  },
});
