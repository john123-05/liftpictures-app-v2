import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  QrCode,
  Mail,
  Camera,
  X,
  AlertCircle,
  CreditCard,
  Ticket,
  Image,
  Newspaper,
  UtensilsCrossed,
  Info,
  Map,
  Star,
  ShoppingCart,
  Clock,
  Zap,
  Gift
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthContext } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '@/components/LanguageSelector';
import RideCaptureModal from '@/components/RideCaptureModal';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const params = useLocalSearchParams<{ captureRide?: string }>();
  const { t, i18n } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showFotopassModal, setShowFotopassModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [showRideCaptureModal, setShowRideCaptureModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTicketType, setSelectedTicketType] = useState<'single' | 'family' | 'season'>('single');
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const { user, loading, session } = useAuthContext();
  const { addToCart } = useCart();
  const [debugInfo, setDebugInfo] = useState('');
  const [hasShownClosingModal, setHasShownClosingModal] = useState(false);
  const [isSubscribingNewsletter, setIsSubscribingNewsletter] = useState(false);
  const [newsletterPopupEnabled, setNewsletterPopupEnabled] = useState(true);
  const [newsletterSettingsLoaded, setNewsletterSettingsLoaded] = useState(false);
  const [newsletterFeedback, setNewsletterFeedback] = useState('');

  // Generate available dates (next 30 days)
  const generateAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: date.toISOString().split('T')[0],
        display: date.toLocaleDateString(i18n.language === 'es' ? 'es-ES' : i18n.language === 'en' ? 'en-US' : 'de-DE', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit'
        }),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isToday: i === 0
      });
    }
    return dates;
  };

  const availableDates = generateAvailableDates();

  const ticketTypes = {
    single: { name: t('tickets.adult'), price: 24.99, description: t('tickets.adultDescription') },
    family: { name: t('tickets.family'), price: 89.99, description: t('tickets.familyDescription') },
    season: { name: t('tickets.season'), price: 149.99, description: t('tickets.seasonDescription') },
  };

  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) {
      setSelectedDate(availableDates[0].date);
    }
  }, []);

  useEffect(() => {
    if (params.captureRide === '1') {
      setShowRideCaptureModal(true);
      router.replace('/(tabs)');
    }
  }, [params.captureRide]);

  useEffect(() => {
    if (!showClosingModal) {
      setNewsletterFeedback('');
    }
  }, [showClosingModal]);

  useEffect(() => {
    let active = true;

    const loadNewsletterSettings = async () => {
      if (!user?.id) {
        if (!active) return;
        setNewsletterPopupEnabled(true);
        setNewsletterSettingsLoaded(true);
        return;
      }

      setNewsletterSettingsLoaded(false);
      try {
        const { data, error } = await supabase
          .from('newsletter_subscriptions')
          .select('popup_enabled')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error('Error loading newsletter popup settings:', error);
          setNewsletterPopupEnabled(true);
        } else {
          setNewsletterPopupEnabled(data?.popup_enabled ?? true);
        }
      } catch (error) {
        if (!active) return;
        console.error('Error loading newsletter popup settings:', error);
        setNewsletterPopupEnabled(true);
      } finally {
        if (active) setNewsletterSettingsLoaded(true);
      }
    };

    loadNewsletterSettings();
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Show closing popup after 15 seconds
  useEffect(() => {
    if (loading || hasShownClosingModal || !newsletterSettingsLoaded || !newsletterPopupEnabled) {
      return;
    }

    const timer = setTimeout(() => {
      setShowClosingModal(true);
      setHasShownClosingModal(true);
    }, 15000);

    return () => clearTimeout(timer);
  }, [loading, hasShownClosingModal, newsletterSettingsLoaded, newsletterPopupEnabled]);

  // Debug authentication state
  useEffect(() => {
    const info = `Loading: ${loading}, User: ${user ? 'Yes' : 'No'}, Session: ${session ? 'Yes' : 'No'}`;
    setDebugInfo(info);
    console.log('Auth Debug:', info);
  }, [user, loading, session]);

  const handleQRScan = async () => {
    setShowRideCaptureModal(true);
  };

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    setShowCamera(false);
    setIsScanning(true);

    // Validate QR code format
    if (!data || data.length < 10) {
      setIsScanning(false);
      Alert.alert(
        t('home.invalidQRCode'),
        t('home.invalidQRCodeDescription'),
        [
          { text: t('home.scanAgain'), onPress: () => setShowCamera(true) },
          { text: t('common.cancel'), style: 'cancel' },
        ]
      );
      return;
    }

    // Simulate processing the QR code data
    setTimeout(() => {
      setIsScanning(false);
      Alert.alert(
        t('home.qrCodeSuccessfullyScanned'),
        `${t('home.sessionID', { id: data.substring(0, 8) })}\n${t('home.loadingPhotos')}`,
        [
          {
            text: t('common.ok'),
            onPress: () => router.push('/(tabs)/gallery'),
          },
        ]
      );
    }, 1500);
  };

  const handleScanError = () => {
    Alert.alert(
      t('home.scanError'),
      t('home.scanErrorDescription'),
      [
        { text: t('home.tryAgain'), onPress: () => setShowCamera(true) },
        { text: t('common.cancel'), style: 'cancel', onPress: () => setShowCamera(false) },
      ]
    );
  };


  const handleBuyFotopass = () => {
    setShowFotopassModal(true);
  };

  const handleAddFotopassToCart = () => {
    const today = new Date().toISOString().split('T')[0];
    const fotopass = {
      id: `tagesfotopass_${today}`,
      name: t('photoPass.title'),
      title: t('photoPass.title'),
      price: 14.99,
      type: 'pass',
      description: t('photoPass.title'),
      selectedDate: today,
    };

    const result = addToCart(fotopass);
    setShowFotopassModal(false);

    const removedCount = result.removedPhotoCount || 0;
    const message = removedCount > 0
      ? `${t('home.photoPassAddedDescription')}\n\n${removedCount} ${removedCount === 1 ? 'Bild' : 'Bilder'} wurden aus dem Warenkorb entfernt.`
      : t('home.photoPassAddedDescription');

    Alert.alert(
      t('home.addedToCart'),
      message,
      [
        { text: t('home.continueShopping'), style: 'cancel' },
        { text: t('home.toCart'), onPress: () => router.push('/(tabs)/cart') },
      ]
    );
  };

  const handleBuyTickets = () => {
    setShowTicketModal(true);
  };

  const handleAddTicketToCart = () => {
    const ticketData = ticketTypes[selectedTicketType];
    const ticket = {
      id: `ticket_${selectedTicketType}_${selectedDate}`,
      name: ticketData.name,
      title: ticketData.name,
      price: ticketData.price,
      type: 'ticket' as const,
      description: ticketData.description,
      selectedDate,
      ticketType: selectedTicketType,
    };

    addToCart(ticket);
    setShowTicketModal(false);

    Alert.alert(
      t('home.addedToCart'),
      t('home.ticketAddedDescription', { ticketName: ticketData.name, date: selectedDate }),
      [
        { text: t('home.continueShopping'), style: 'cancel' },
        { text: t('home.toCart'), onPress: () => router.push('/(tabs)/cart') },
      ]
    );
  };

  const handleNews = () => {
    router.push('/news');
  };

  const handleMenu = () => {
    router.push('/menu');
  };

  const handleInfo = () => {
    router.push('/info');
  };

  const handleMap = () => {
    router.push('/map');
  };

  const handleSubscribeNewsletter = async () => {
    if (!user?.id) {
      Alert.alert('Hinweis', 'Bitte zuerst anmelden, um den Newsletter zu abonnieren.');
      return;
    }

    setIsSubscribingNewsletter(true);
    setNewsletterFeedback('');
    try {
      const nowIso = new Date().toISOString();
      const { data: existing, error: existingError } = await supabase
        .from('newsletter_subscriptions')
        .select('subscribed, popup_enabled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.subscribed) {
        setNewsletterFeedback('Sie sind bereits fuer den Newsletter angemeldet.');
        Alert.alert('Hinweis', 'Sie sind bereits fuer den Newsletter angemeldet.');
        return;
      }

      const { error } = await supabase
        .from('newsletter_subscriptions')
        .upsert(
          {
            user_id: user.id,
            email: user.email || null,
            subscribed: true,
            subscribed_at: nowIso,
            unsubscribed_at: null,
            source: 'closing_modal',
            popup_enabled: existing?.popup_enabled ?? true,
          } as any,
          { onConflict: 'user_id' },
        );

      if (error) throw error;

      setNewsletterFeedback('Danke fuer dein Abonnement.');
      Alert.alert(
        t('closingModal.subscribed'),
        t('closingModal.subscribedDescription'),
        [{ text: t('closingModal.perfect'), style: 'default' }]
      );
      setTimeout(() => {
        setShowClosingModal(false);
      }, 1200);
    } catch (error: any) {
      const msg = error?.message || 'Newsletter konnte nicht gespeichert werden.';
      setNewsletterFeedback(msg);
      Alert.alert('Fehler', msg);
    } finally {
      setIsSubscribingNewsletter(false);
    }
  };

  const closeCamera = () => {
    setShowCamera(false);
  };


  // Camera view for QR scanning
  if (showCamera && Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <StatusBar style="light" backgroundColor="#000" />
        
        <CameraView
          style={styles.camera}
          facing={facing}
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={closeCamera}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.cameraTitle}>{t('home.scanQRTitle')}</Text>
              <View style={styles.placeholder} />
            </View>

            <View style={styles.scanArea}>
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                
                {/* Scanning animation line */}
                <View style={styles.scanLine} />
              </View>
              
              <Text style={styles.scanInstruction}>
                {t('home.scanInstruction')}
              </Text>
            </View>

            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.flipButton}
                onPress={() => setFacing(current => (current === 'back' ? 'front' : 'back'))}
              >
                <Camera size={24} color="#fff" />
                <Text style={styles.flipButtonText}>{t('home.switchCamera')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.helpButton}
                onPress={handleScanError}
              >
                <Text style={styles.helpButtonText}>{t('home.problemsScanning')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />
      
      <LinearGradient
        colors={['#000', '#1a1a1a']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>Liftpictures</Text>
          <Text style={styles.subtitle}>
            {t('home.welcome', { name: user?.vorname || 'Guest' })}
          </Text>
        </View>

        <View style={styles.languageSelectorContainer}>
          <LanguageSelector />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main Actions - Always Available */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('home.photosAndMemories')}</Text>

            <TouchableOpacity
              style={[styles.mainActionButton, isScanning && styles.scanningButton]}
              onPress={handleQRScan}
              disabled={isScanning}
            >
              <QrCode size={32} color="#000" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.mainActionButtonText}>
                  {isScanning ? t('home.processing') : t('home.scanQR')}
                </Text>
                <Text style={styles.mainActionButtonSubtext}>
                  {t('home.findYourPhotos')}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={() => router.push('/(tabs)/gallery')}
            >
              <Image size={24} color="#ff6b35" />
              <Text style={styles.secondaryActionButtonText}>{t('home.toGallery')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('home.purchaseOptions')}</Text>
            
            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.gridButton} onPress={handleBuyFotopass}>
                <Star size={24} color="#ff6b35" />
                <Text style={styles.gridButtonTitle}>{t('home.dayPhotoPass')}</Text>
                <Text style={styles.gridButtonSubtitle}>€14.99</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridButton} onPress={handleBuyTickets}>
                <Ticket size={24} color="#ff6b35" />
                <Text style={styles.gridButtonTitle}>{t('home.parkTickets')}</Text>
                <Text style={styles.gridButtonSubtitle}>{t('home.from')} €24.99</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('home.parkInfo')}</Text>

            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.gridButton} onPress={handleNews}>
                <Newspaper size={24} color="#ff6b35" />
                <Text style={styles.gridButtonTitle}>{t('home.news')}</Text>
                <Text style={styles.gridButtonSubtitle}>{t('home.whatsNew')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridButton} onPress={handleMenu}>
                <UtensilsCrossed size={24} color="#ff6b35" />
                <Text style={styles.gridButtonTitle}>{t('home.menu')}</Text>
                <Text style={styles.gridButtonSubtitle}>{t('home.restaurantAndSnacks')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridButton} onPress={handleInfo}>
                <Info size={24} color="#ff6b35" />
                <Text style={styles.gridButtonTitle}>{t('home.infos')}</Text>
                <Text style={styles.gridButtonSubtitle}>{t('home.openingHoursEtc')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridButton} onPress={handleMap}>
                <Map size={24} color="#ff6b35" />
                <Text style={styles.gridButtonTitle}>{t('home.parkMap')}</Text>
                <Text style={styles.gridButtonSubtitle}>{t('home.whereIsWhat')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.disclaimerSection}>
          <Text style={styles.demoVersionText}>Demo Version 0.01</Text>
          <TouchableOpacity onPress={() => setShowDemoModal(true)}>
            <Text style={styles.mehrText}>mehr</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('home.secureMemories')}
          </Text>
        </View>

        {/* Tagesfotopass Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showFotopassModal}
          onRequestClose={() => setShowFotopassModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('photoPass.title')}</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowFotopassModal(false)}
                >
                  <X size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.priceSection}>
                  <Text style={styles.modalPrice}>{t('photoPass.price')}</Text>
                  <Text style={styles.modalPriceSubtext}>{t('photoPass.oneTimePrice')}</Text>
                </View>

                <View style={styles.benefitSection}>
                  <Text style={styles.benefitTitle}>{t('photoPass.whatYouGet')}</Text>

                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>📸</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitTextBold}>{t('photoPass.unlimitedPhotos')}</Text>{'\n'}
                      {t('photoPass.unlimitedPhotosDescription')}
                    </Text>
                  </View>

                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>💾</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitTextBold}>{t('photoPass.instantDownload')}</Text>{'\n'}
                      {t('photoPass.instantDownloadDescription')}
                    </Text>
                  </View>

                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>💰</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitTextBold}>{t('photoPass.save')}</Text>{'\n'}
                      {t('photoPass.saveDescription')}
                    </Text>
                  </View>

                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>⭐</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitTextBold}>{t('photoPass.noWaitTime')}</Text>{'\n'}
                      {t('photoPass.noWaitTimeDescription')}
                    </Text>
                  </View>
                </View>

                <View style={styles.howItWorksSection}>
                  <Text style={styles.howItWorksTitle}>{t('photoPass.howItWorks')}</Text>
                  <Text style={styles.howItWorksText}>
                    {t('photoPass.step1')}{'\n'}
                    {t('photoPass.step2')}{'\n'}
                    {t('photoPass.step3')}{'\n'}
                    {t('photoPass.step4')}
                  </Text>
                </View>

                <View style={styles.validitySection}>
                  <Text style={styles.validityTitle}>{t('photoPass.validity')}</Text>
                  <Text style={styles.validityText}>
                    {t('photoPass.validityText')}
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.addToCartButton}
                  onPress={handleAddFotopassToCart}
                >
                  <ShoppingCart size={20} color="#000" />
                  <Text style={styles.addToCartButtonText}>
                    {t('photoPass.addToCart')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowFotopassModal(false)}
                >
                  <Text style={styles.cancelButtonText}>{t('photoPass.decideLater')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Closing Time Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showClosingModal}
          onRequestClose={() => setShowClosingModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.closingModalContent}>
              <TouchableOpacity
                style={styles.closingModalCloseButton}
                onPress={() => setShowClosingModal(false)}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>

              <View style={styles.closingModalHeader}>
                <Clock size={32} color="#ff6b35" />
                <Text style={styles.closingModalTitle}>
                  {t('closingModal.title')}
                </Text>
              </View>

              <ScrollView style={styles.closingModalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.closingModalText}>
                  {t('closingModal.lastChance')}
                </Text>
                <Text style={styles.closingActionSubtitle}>
                  {t('closingModal.description')}
                </Text>

                <View style={styles.closingActionCard}>
                  <Ticket size={24} color="#00c851" />
                  <View style={styles.closingActionText}>
                    <Text style={styles.closingActionTitle}>
                      {t('closingModal.bookTicket')}
                    </Text>
                    <Text style={styles.closingActionSubtitle}>
                      {t('closingModal.bookTicketDescription')}
                    </Text>
                  </View>
                </View>

                <View style={styles.newsletterSection}>
                  <Gift size={28} color="#ffc107" />
                  <Text style={styles.newsletterTitle}>
                    {t('closingModal.newsletter')}
                  </Text>
                  <Text style={styles.newsletterText}>
                    {t('closingModal.newsletterDescription')}
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.closingModalFooter}>
                <TouchableOpacity
                  style={styles.newsletterButton}
                  onPress={handleSubscribeNewsletter}
                  disabled={isSubscribingNewsletter}
                >
                  <Mail size={20} color="#000" />
                  <Text style={styles.newsletterButtonText}>
                    {isSubscribingNewsletter ? 'Speichert...' : t('closingModal.subscribeNewsletter')}
                  </Text>
                </TouchableOpacity>
                {newsletterFeedback ? (
                  <Text style={styles.newsletterFeedbackText}>{newsletterFeedback}</Text>
                ) : null}

                <TouchableOpacity
                  style={styles.ticketBookButton}
                  onPress={() => {
                    setShowClosingModal(false);
                    setShowTicketModal(true);
                  }}
                >
                  <Ticket size={20} color="#000" />
                  <Text style={styles.ticketBookButtonText}>
                    {t('closingModal.bookTicketForNext')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closingDismissButton}
                  onPress={() => setShowClosingModal(false)}
                >
                  <Text style={styles.closingDismissButtonText}>
                    {t('closingModal.goodbye')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {/* Park Tickets Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showTicketModal}
          onRequestClose={() => setShowTicketModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('tickets.title')}</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowTicketModal(false)}
                >
                  <X size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Ticket Type Selection */}
                <View style={styles.ticketTypeSection}>
                  <Text style={styles.sectionTitle}>{t('tickets.selectType')}</Text>
                  
                  {Object.entries(ticketTypes).map(([key, ticket]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.ticketTypeOption,
                        selectedTicketType === key && styles.selectedTicketType
                      ]}
                      onPress={() => setSelectedTicketType(key as any)}
                    >
                      <View style={styles.ticketTypeInfo}>
                        <Text style={[
                          styles.ticketTypeName,
                          selectedTicketType === key && styles.selectedTicketTypeName
                        ]}>
                          {ticket.name}
                        </Text>
                        <Text style={[
                          styles.ticketTypeDescription,
                          selectedTicketType === key && styles.selectedTicketTypeDescription
                        ]}>
                          {ticket.description}
                        </Text>
                      </View>
                      <Text style={[
                        styles.ticketTypePrice,
                        selectedTicketType === key && styles.selectedTicketTypePrice
                      ]}>
                        €{ticket.price.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Date Selection */}
                <View style={styles.dateSection}>
                  <Text style={styles.sectionTitle}>{t('tickets.selectDate')}</Text>
                  
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                    {availableDates.map((dateInfo) => (
                      <TouchableOpacity
                        key={dateInfo.date}
                        style={[
                          styles.dateOption,
                          selectedDate === dateInfo.date && styles.selectedDate,
                          dateInfo.isWeekend && styles.weekendDate,
                          dateInfo.isToday && styles.todayDate
                        ]}
                        onPress={() => setSelectedDate(dateInfo.date)}
                      >
                        <Text style={[
                          styles.dateText,
                          selectedDate === dateInfo.date && styles.selectedDateText,
                          dateInfo.isToday && styles.todayDateText
                        ]}>
                          {dateInfo.display}
                        </Text>
                        {dateInfo.isToday && (
                          <Text style={styles.todayLabel}>{t('tickets.today')}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Ticket Benefits */}
                <View style={styles.benefitSection}>
                  <Text style={styles.benefitTitle}>{t('tickets.included')}</Text>

                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>🎢</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitTextBold}>{t('tickets.allAttractions')}</Text>{'\n'}
                      {t('tickets.allAttractionsDescription')}
                    </Text>
                  </View>

                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>🎭</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitTextBold}>{t('tickets.showsIncluded')}</Text>{'\n'}
                      {t('tickets.showsIncludedDescription')}
                    </Text>
                  </View>

                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>🚗</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitTextBold}>{t('tickets.freeParking')}</Text>{'\n'}
                      {t('tickets.freeParkingDescription')}
                    </Text>
                  </View>

                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>👨‍👩‍👧‍👦</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitTextBold}>{t('tickets.familyFriendly')}</Text>{'\n'}
                      {t('tickets.familyFriendlyDescription')}
                    </Text>
                  </View>
                </View>

                {/* Price Summary */}
                <View style={styles.priceSummary}>
                  <Text style={styles.priceSummaryTitle}>{t('tickets.summary')}</Text>
                  <View style={styles.priceSummaryRow}>
                    <Text style={styles.priceSummaryText}>
                      {ticketTypes[selectedTicketType].name}
                    </Text>
                    <Text style={styles.priceSummaryPrice}>
                      €{ticketTypes[selectedTicketType].price.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.priceSummaryRow}>
                    <Text style={styles.priceSummaryText}>
                      {t('tickets.date', { date: availableDates.find(d => d.date === selectedDate)?.display })}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.addToCartButton}
                  onPress={handleAddTicketToCart}
                >
                  <ShoppingCart size={20} color="#000" />
                  <Text style={styles.addToCartButtonText}>
                    {t('tickets.addToCart', { price: ticketTypes[selectedTicketType].price.toFixed(2) })}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowTicketModal(false)}
                >
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Ride Capture Modal */}
        <RideCaptureModal
          visible={showRideCaptureModal}
          onClose={() => setShowRideCaptureModal(false)}
          onSuccess={() => {
            setShowRideCaptureModal(false);
          }}
        />

        {/* Demo Version Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showDemoModal}
          onRequestClose={() => setShowDemoModal(false)}
        >
          <View style={styles.demoModalOverlay}>
            <View style={styles.demoModalContent}>
              <TouchableOpacity
                style={styles.demoModalCloseButton}
                onPress={() => setShowDemoModal(false)}
              >
                <X size={20} color="#fff" />
              </TouchableOpacity>

              <Text style={styles.demoModalTitle}>📱 Demo Version 0.01</Text>
              <Text style={styles.demoModalText}>
                Dies ist eine Web-App zu Demonstrationszwecken. Die vollständige App wird in zukünftigen Entwicklungen in den App Stores verfügbar sein.
              </Text>
            </View>
          </View>
        </Modal>

      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff6b35',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 22,
  },
  languageSelectorContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  mainActionButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scanningButton: {
    opacity: 0.7,
  },
  buttonTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  mainActionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  mainActionButtonSubtext: {
    fontSize: 14,
    color: '#333',
  },
  secondaryActionButton: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  secondaryActionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ff6b35',
    marginLeft: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '48%',
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gridButtonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
  gridButtonSubtitle: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 4,
    textAlign: 'center',
  },
  authDescription: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  disclaimerSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  demoVersionText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  mehrText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
    textDecorationLine: 'underline',
  },
  ticketBookButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ticketBookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  closingDismissButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  closingDismissButtonText: {
    fontSize: 16,
    color: '#ccc',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Camera Styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
    marginBottom: 40,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#ff6b35',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#ff6b35',
    opacity: 0.8,
  },
  scanInstruction: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 22,
  },
  cameraControls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  flipButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  flipButtonText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
  },
  helpButton: {
    padding: 8,
  },
  helpButtonText: {
    fontSize: 14,
    color: '#ff6b35',
    textDecorationLine: 'underline',
  },
  // Modal Styles
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
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 428 : '100%',
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
  },
  priceSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalPrice: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ff6b35',
  },
  modalPriceSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
  benefitSection: {
    paddingVertical: 24,
  },
  benefitTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  benefitTextBold: {
    fontWeight: '600',
    color: '#fff',
  },
  howItWorksSection: {
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  howItWorksTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  howItWorksText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  validitySection: {
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  validityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  validityText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  addToCartButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  addToCartButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#ccc',
  },
  // Ticket Modal Styles
  ticketTypeSection: {
    paddingVertical: 20,
  },
  ticketTypeOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedTicketType: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderColor: '#ff6b35',
  },
  ticketTypeInfo: {
    flex: 1,
  },
  ticketTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  selectedTicketTypeName: {
    color: '#ff6b35',
  },
  ticketTypeDescription: {
    fontSize: 14,
    color: '#ccc',
  },
  selectedTicketTypeDescription: {
    color: '#fff',
  },
  ticketTypePrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  selectedTicketTypePrice: {
    color: '#ff6b35',
  },
  dateSection: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateScroll: {
    marginTop: 12,
  },
  dateOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedDate: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderColor: '#ff6b35',
  },
  weekendDate: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  todayDate: {
    backgroundColor: 'rgba(0, 200, 81, 0.1)',
    borderColor: '#00c851',
  },
  dateText: {
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
  },
  selectedDateText: {
    color: '#ff6b35',
    fontWeight: '600',
  },
  todayDateText: {
    color: '#00c851',
    fontWeight: '600',
  },
  todayLabel: {
    fontSize: 10,
    color: '#00c851',
    marginTop: 2,
    fontWeight: '500',
  },
  priceSummary: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  priceSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  priceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceSummaryText: {
    fontSize: 14,
    color: '#ccc',
  },
  priceSummaryPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b35',
  },
  // Closing Modal Styles
  closingModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '70%',
    width: '100%',
    position: 'relative',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 428 : '100%',
  },
  closingModalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 8,
    zIndex: 1,
  },
  closingModalHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closingModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 12,
  },
  closingModalBody: {
    flex: 1,
    paddingHorizontal: 20,
  },
  closingModalText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ff6b35',
    textAlign: 'center',
    marginBottom: 8,
  },
  closingActionSubtitle: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  closingActionCard: {
    backgroundColor: 'rgba(0, 200, 81, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 81, 0.3)',
  },
  closingActionText: {
    flex: 1,
    marginLeft: 16,
  },
  closingActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  newsletterSection: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  newsletterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  newsletterText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 20,
  },
  newsletterHighlight: {
    color: '#ffc107',
    fontWeight: '600',
  },
  closingModalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  newsletterButton: {
    backgroundColor: '#ffc107',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  newsletterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  newsletterFeedbackText: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: 13,
    color: '#9ad29a',
    textAlign: 'center',
  },
  // Demo Modal Styles
  demoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  demoModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    position: 'relative',
  },
  demoModalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 6,
    zIndex: 1,
  },
  demoModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  demoModalText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    textAlign: 'center',
  },
});
