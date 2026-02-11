import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Dimensions } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { BarcodeScanningResult } from 'expo-camera';
import { X, Camera, Flashlight, FlashlightOff, RotateCcw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  interpolate,
  Easing
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface QRScannerProps {
  onScanSuccess: (data: string) => void;
  onClose: () => void;
  onError?: (error: string) => void;
}

export default function QRScanner({ onScanSuccess, onClose, onError }: QRScannerProps) {
  const [facing, setFacing] = useState<CameraType>('back');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanTimeout, setScanTimeout] = useState<NodeJS.Timeout | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // Animation values
  const scanLinePosition = useSharedValue(0);
  const cornerAnimation = useSharedValue(0);

  useEffect(() => {
    // Start scan line animation
    scanLinePosition.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );

    // Start corner animation
    cornerAnimation.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // Set timeout for no QR code found
    const timeout = setTimeout(() => {
      if (!hasScanned) {
        Alert.alert(
          'Kein QR-Code erkannt',
          'Es wurde kein QR-Code gefunden. Stellen Sie sicher, dass der Code gut sichtbar ist und versuchen Sie es erneut.',
          [
            { text: 'Erneut versuchen', style: 'default' },
            { text: 'Abbrechen', style: 'cancel', onPress: onClose },
          ]
        );
      }
    }, 10000);

    setScanTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  // Check permissions
  useEffect(() => {
    if (!permission) return;

    if (!permission.granted) {
      requestPermission().then((result) => {
        if (!result.granted) {
          Alert.alert(
            'Kamera-Berechtigung erforderlich',
            'Um QR-Codes zu scannen, benötigen wir Zugriff auf Ihre Kamera. Dies ist notwendig, um Ihre Fotos von der Sommerrodelbahn zu finden.',
            [
              { text: 'Abbrechen', style: 'cancel', onPress: onClose },
              { text: 'Berechtigung erteilen', onPress: () => requestPermission() },
            ]
          );
        }
      });
    }
  }, [permission]);

  const handleBarcodeScanned = ({ type, data }: BarcodeScanningResult) => {
    if (hasScanned) return;

    setHasScanned(true);
    if (scanTimeout) clearTimeout(scanTimeout);

    // Validate QR code format
    if (!data || data.length < 8) {
      Alert.alert(
        'Ungültiger QR-Code',
        'Der gescannte Code ist nicht gültig. Bitte versuchen Sie es erneut oder wenden Sie sich an das Personal.',
        [
          { 
            text: 'Erneut scannen', 
            onPress: () => {
              setHasScanned(false);
              const newTimeout = setTimeout(() => {
                if (!hasScanned) {
                  onError?.('Scan timeout');
                }
              }, 10000);
              setScanTimeout(newTimeout);
            }
          },
          { text: 'Abbrechen', style: 'cancel', onPress: onClose },
        ]
      );
      return;
    }

    // Extract session ID from QR code data
    let sessionId = data;
    try {
      // Handle different QR code formats
      if (data.includes('session=')) {
        const url = new URL(data);
        sessionId = url.searchParams.get('session') || data;
      } else if (data.includes('?')) {
        // Handle query string format
        const parts = data.split('?')[1];
        const params = new URLSearchParams(parts);
        sessionId = params.get('session') || params.get('id') || data;
      }
    } catch (error) {
      // If URL parsing fails, use the raw data
      sessionId = data;
    }

    onScanSuccess(sessionId);
  };

  const toggleFlash = () => {
    setFlashEnabled(!flashEnabled);
  };

  const flipCamera = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  // Animated styles
  const scanLineStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scanLinePosition.value,
            [0, 1],
            [0, 240] // Height of scan area
          ),
        },
      ],
    };
  });

  const cornerStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      cornerAnimation.value,
      [0, 1],
      [1, 1.1]
    );
    
    return {
      transform: [{ scale }],
    };
  });

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Kamera-Berechtigung wird überprüft...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Camera size={80} color="#666" />
        <Text style={styles.permissionTitle}>Kamera-Zugriff erforderlich</Text>
        <Text style={styles.permissionText}>
          Um QR-Codes zu scannen, benötigen wir Zugriff auf Ihre Kamera.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Berechtigung erteilen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        flash={flashEnabled ? 'on' : 'off'}
        onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'pdf417'],
        }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.7)']}
          style={styles.overlay}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>QR-Code scannen</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Scan Area */}
          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              {/* Animated corners */}
              <Animated.View style={[styles.corner, styles.topLeft, cornerStyle]} />
              <Animated.View style={[styles.corner, styles.topRight, cornerStyle]} />
              <Animated.View style={[styles.corner, styles.bottomLeft, cornerStyle]} />
              <Animated.View style={[styles.corner, styles.bottomRight, cornerStyle]} />
              
              {/* Animated scan line */}
              <Animated.View style={[styles.scanLine, scanLineStyle]} />
              
              {/* Center dot */}
              <View style={styles.centerDot} />
            </View>
            
            <Text style={styles.instruction}>
              Richten Sie die Kamera auf den QR-Code
            </Text>
            
            <Text style={styles.subInstruction}>
              Der Code befindet sich an Ihrem Platz oder am Ausgang
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={flipCamera}>
              <RotateCcw size={24} color="#fff" />
              <Text style={styles.controlText}>Kamera wechseln</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
              {flashEnabled ? (
                <FlashlightOff size={24} color="#fff" />
              ) : (
                <Flashlight size={24} color="#fff" />
              )}
              <Text style={styles.controlText}>
                {flashEnabled ? 'Blitz aus' : 'Blitz an'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Notice */}
          <View style={styles.privacyNotice}>
            <Text style={styles.privacyText}>
              🔒 Die Kamera wird nur zum Scannen verwendet und speichert keine Bilder
            </Text>
          </View>
        </LinearGradient>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
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
    width: 280,
    height: 280,
    position: 'relative',
    marginBottom: 40,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#ff6b35',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#ff6b35',
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  centerDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 8,
    height: 8,
    backgroundColor: '#ff6b35',
    borderRadius: 4,
    marginTop: -4,
    marginLeft: -4,
  },
  instruction: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  subInstruction: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  controlText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  privacyNotice: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  privacyText: {
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
});