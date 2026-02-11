import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

export default function NotificationsScreen() {
  const { user } = useAuthContext();
  const { t } = useTranslation();
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [newsletterPopupEnabled, setNewsletterPopupEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('newsletter_subscriptions')
          .select('subscribed, popup_enabled')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        setNewsletterSubscribed(Boolean(data?.subscribed));
        setNewsletterPopupEnabled(data?.popup_enabled ?? true);
      } catch (error: any) {
        console.error('Error loading newsletter settings:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  const handleToggleNewsletter = async (nextValue: boolean) => {
    if (!user?.id || saving) return;

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('newsletter_subscriptions')
        .upsert(
          {
            user_id: user.id,
            email: user.email || null,
            subscribed: nextValue,
            subscribed_at: nextValue ? nowIso : null,
            unsubscribed_at: nextValue ? null : nowIso,
            source: 'profile_notifications',
            popup_enabled: newsletterPopupEnabled,
          } as any,
          { onConflict: 'user_id' },
        );

      if (error) throw error;

      setNewsletterSubscribed(nextValue);
      Alert.alert(
        t('notificationsPage.title'),
        nextValue ? t('notificationsPage.newsletterSubscribed') : t('notificationsPage.newsletterUnsubscribed'),
      );
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message || t('notificationsPage.settingsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePopup = async (nextValue: boolean) => {
    if (!user?.id || saving) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('newsletter_subscriptions')
        .upsert(
          {
            user_id: user.id,
            email: user.email || null,
            subscribed: newsletterSubscribed,
            popup_enabled: nextValue,
            source: 'profile_notifications',
          } as any,
          { onConflict: 'user_id' },
        );

      if (error) throw error;

      setNewsletterPopupEnabled(nextValue);
      Alert.alert(
        t('notificationsPage.title'),
        nextValue ? t('notificationsPage.popupEnabled') : t('notificationsPage.popupDisabled'),
      );
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message || t('notificationsPage.settingsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('notificationsPage.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.rowLeft}>
            <Bell size={20} color="#ff8c42" />
            <View style={styles.textBlock}>
              <Text style={styles.rowTitle}>{t('notificationsPage.newsletterTitle')}</Text>
              <Text style={styles.rowSubtitle}>
                {t('notificationsPage.newsletterSubtitle')}
              </Text>
            </View>
          </View>

          <Switch
            value={newsletterSubscribed}
            onValueChange={handleToggleNewsletter}
            disabled={loading || saving}
            trackColor={{ false: '#444', true: '#44b868' }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.card, styles.cardSpacing]}>
          <View style={styles.rowLeft}>
            <Bell size={20} color="#ff8c42" />
            <View style={styles.textBlock}>
              <Text style={styles.rowTitle}>{t('notificationsPage.popupTitle')}</Text>
              <Text style={styles.rowSubtitle}>
                {t('notificationsPage.popupSubtitle')}
              </Text>
            </View>
          </View>

          <Switch
            value={newsletterPopupEnabled}
            onValueChange={handleTogglePopup}
            disabled={loading || saving}
            trackColor={{ false: '#444', true: '#44b868' }}
            thumbColor="#fff"
          />
        </View>

        <Text style={styles.hintText}>
          {loading ? t('notificationsPage.loading') : saving ? t('notificationsPage.saving') : t('notificationsPage.persistedHint')}
        </Text>
      </View>
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
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  card: {
    backgroundColor: '#171717',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardSpacing: {
    marginTop: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  textBlock: {
    flex: 1,
  },
  rowTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  rowSubtitle: {
    color: '#bbb',
    fontSize: 13,
    lineHeight: 18,
  },
  hintText: {
    marginTop: 14,
    color: '#8f8f8f',
    fontSize: 12,
  },
});
