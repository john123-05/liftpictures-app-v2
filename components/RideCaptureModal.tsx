import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, Platform } from 'react-native';
import { Clock, X, Check, CalendarDays } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface RideCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RideCaptureModal({ visible, onClose, onSuccess }: RideCaptureModalProps) {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(now.toISOString().split('T')[0]);
  const [selectedHour, setSelectedHour] = useState(now.getHours());
  const [selectedMinute, setSelectedMinute] = useState(now.getMinutes());
  const [hourText, setHourText] = useState(String(now.getHours()).padStart(2, '0'));
  const [minuteText, setMinuteText] = useState(String(now.getMinutes()).padStart(2, '0'));
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const getDefaultCameraCode = async (): Promise<string | null> => {
    if (!user) return null;

    const parkId = user.park_id || '11111111-1111-1111-1111-111111111111';
    const { data, error } = await supabase
      .from('park_cameras')
      .select('customer_code')
      .eq('park_id', parkId)
      .eq('is_active', true);

    if (error) {
      console.error('Error loading active cameras for ride:', error);
      return null;
    }

    const uniqueCodes = Array.from(
      new Set((data || []).map((row: any) => row.customer_code).filter(Boolean))
    );

    return uniqueCodes.length === 1 ? uniqueCodes[0] : null;
  };

  useEffect(() => {
    if (visible) {
      setShowSuccess(false);
      const now = new Date();
      setSelectedDate(now.toISOString().split('T')[0]);
      setSelectedHour(now.getHours());
      setSelectedMinute(now.getMinutes());
      setHourText(String(now.getHours()).padStart(2, '0'));
      setMinuteText(String(now.getMinutes()).padStart(2, '0'));
    }
  }, [visible]);

  const handleCaptureNow = async () => {
    if (!user) {
      alert('User not authenticated');
      return;
    }

    setSaving(true);
    try {
      const cameraCode = await getDefaultCameraCode();
      const { error } = await supabase
        .from('rides')
        .insert({
          user_id: user.id,
          park_id: user.park_id || '11111111-1111-1111-1111-111111111111',
          ride_at: new Date().toISOString(),
          source: 'now',
          note: null,
          camera_code: cameraCode,
        });

      if (error) throw error;

      setShowSuccess(true);

      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 2000);
    } catch (error: any) {
      console.error('Error saving ride:', error);
      alert(error.message || 'Failed to save ride');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveManual = async () => {
    if (!user) {
      alert('User not authenticated');
      return;
    }

    setSaving(true);
    try {
      const rideDateTime = new Date(selectedDate);
      rideDateTime.setHours(selectedHour, selectedMinute, 0, 0);
      const cameraCode = await getDefaultCameraCode();

      const { error } = await supabase
        .from('rides')
        .insert({
          user_id: user.id,
          park_id: user.park_id || '11111111-1111-1111-1111-111111111111',
          ride_at: rideDateTime.toISOString(),
          source: 'manual',
          note: null,
          camera_code: cameraCode,
        });

      if (error) throw error;

      setShowSuccess(true);

      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 2000);
    } catch (error: any) {
      console.error('Error saving ride:', error);
      alert(error.message || 'Failed to save ride');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setShowSuccess(false);
    onClose();
  };

  const formatTime = () => {
    return `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
  };

  const formatDate = () => {
    const date = new Date(selectedDate);
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{showSuccess ? 'Bestätigung' : t('rides.title')}</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleClose}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {showSuccess ? (
            <View style={styles.successContainer}>
              <View style={styles.successContent}>
                <View style={styles.successIconContainer}>
                  <Check size={64} color="#00c851" />
                </View>
                <Text style={styles.successTitle}>Deine Fahrt wurde erfasst!</Text>
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={handleClose}
                >
                  <Text style={styles.successButtonText}>Schließen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={handleCaptureNow}
              disabled={saving}
            >
              <Clock size={24} color="#000" />
              <Text style={styles.primaryActionText}>{t('rides.captureNow')}</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('common.or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.manualSection}>
              <Text style={styles.sectionTitle}>{t('rides.manualTime')}</Text>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>{t('rides.selectDate')}</Text>
                <View style={styles.dateTimeButton}>
                  <CalendarDays size={20} color="#ff6b35" />
                  <TextInput
                    style={styles.dateInput}
                    value={selectedDate}
                    onChangeText={setSelectedDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>{t('rides.selectTime')}</Text>
                <View style={styles.timePickerRow}>
                  <View style={styles.timePickerContainer}>
                    <Clock size={20} color="#ff6b35" />
                    <TextInput
                      style={styles.timeInput}
                      value={hourText}
                      onChangeText={(text) => {
                        setHourText(text);
                      }}
                      onBlur={() => {
                        const hour = parseInt(hourText);
                        if (isNaN(hour) || hour < 0 || hour > 23) {
                          setHourText(String(selectedHour).padStart(2, '0'));
                        } else {
                          setSelectedHour(hour);
                          setHourText(String(hour).padStart(2, '0'));
                        }
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="HH"
                      placeholderTextColor="#666"
                    />
                    <Text style={styles.timeSeparator}>:</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={minuteText}
                      onChangeText={(text) => {
                        setMinuteText(text);
                      }}
                      onBlur={() => {
                        const minute = parseInt(minuteText);
                        if (isNaN(minute) || minute < 0 || minute > 59) {
                          setMinuteText(String(selectedMinute).padStart(2, '0'));
                        } else {
                          setSelectedMinute(minute);
                          setMinuteText(String(minute).padStart(2, '0'));
                        }
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="MM"
                      placeholderTextColor="#666"
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveManual}
                disabled={saving}
              >
                <Check size={20} color="#000" />
                <Text style={styles.saveButtonText}>{t('rides.saveTime')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.futureSection}>
              <Text style={styles.futureSectionTitle}>{t('rides.qrFuture')}</Text>
              <Text style={styles.futureSectionText}>
                {t('rides.qrFuture')}
              </Text>
            </View>
          </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      maxWidth: 428,
      marginHorizontal: 'auto',
      width: '100%',
    } : {}),
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    width: '100%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 8,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  primaryActionButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  primaryActionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 16,
  },
  manualSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  inputRow: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  dateTimeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateInput: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
    flex: 1,
  },
  timePickerRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    fontSize: 20,
    color: '#fff',
    marginLeft: 12,
    width: 40,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 20,
    color: '#fff',
    marginHorizontal: 4,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: '#00c851',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  futureSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  futureSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  futureSectionText: {
    fontSize: 12,
    color: '#666',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  successContent: {
    alignItems: 'center',
    width: '100%',
  },
  successIconContainer: {
    backgroundColor: 'rgba(0, 200, 81, 0.1)',
    borderRadius: 60,
    padding: 20,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 32,
  },
  successButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
  },
  successButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
});
