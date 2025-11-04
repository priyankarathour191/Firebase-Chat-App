import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  signInWithGoogle,
  sendOTP,
  verifyOTP,
  firestore,
  auth,
  verifyOTPAndStorePhone,
} from '../config/firebase';

const LoginScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('initial');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      console.log('Attempting Google Sign-In...');
      const result = await signInWithGoogle();

      console.log('Google Sign in successful!');
      setGoogleUser(result.user);

      setStep('phone');

    } catch (error) {
      console.log('Sign in error:', error);
      Alert.alert('Sign In Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    const formattedPhone = phoneNumber.startsWith('+')
      ? phoneNumber
      : `+91${phoneNumber}`;

    setLoading(true);
    try {
      const confirm = await sendOTP(formattedPhone);
      setConfirmation(confirm);
      setStep('otp');
      Alert.alert('Success', 'OTP sent successfully!');
    } catch (error) {
      console.log('OTP send error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

const handleVerifyOTP = async () => {
  if (!otp.trim() || otp.length !== 6) {
    Alert.alert('Error', 'Please enter a valid 6-digit OTP');
    return;
  }

  setLoading(true);
  try {
    if (googleUser) {
      const phoneCredential = auth.PhoneAuthProvider.credential(
        confirmation.verificationId,
        otp
      );

      await googleUser.linkWithCredential(phoneCredential);

      console.log("Phone successfully linked to Google Account!");

      await firestore()
        .collection('users')
        .doc(googleUser.uid)
        .set(
          {
            phone: googleUser.phoneNumber,
            email: googleUser.email,
            createdAt: new Date(),
          },
          { merge: true }
        );

      navigation.reset({ index: 0, routes: [{ name: 'ChatListScreen' }] });
      return;
    }

    const phoneUser = await confirmation.confirm(otp);

    await firestore()
      .collection('users')
      .doc(phoneUser.user.uid)
      .set(
        {
          phone: phoneUser.user.phoneNumber,
          createdAt: new Date(),
        },
        { merge: true }
      );

    navigation.reset({ index: 0, routes: [{ name: 'ChatListScreen' }] });

  } catch (error) {
    console.error("Verification error:", error);
    Alert.alert('Verification Failed', error.message);
  } finally {
    setLoading(false);
  }
};



  const renderInitialStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Welcome to chordify</Text>
      <Text style={styles.subtitle}>Choose how you want to sign in</Text>

      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
        disabled={loading}
      >
        <Text style={styles.googleButtonText}>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.phoneButton}
        onPress={() => setStep('phone')}
      >
        <Text style={styles.phoneButtonText}>Sign in with Phone Number</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPhoneStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Phone Verification</Text>
      <Text style={styles.subtitle}>Enter your phone number</Text>

      <TextInput
        style={styles.input}
        placeholder="Phone Number (+91XXXXXXXXXX)"
        keyboardType="phone-pad"
        value={phoneNumber}
          placeholderTextColor='gray'
        onChangeText={setPhoneNumber}
        maxLength={13}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSendOTP}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setStep('initial')}
      >
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOTPStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter 6-digit OTP"
          placeholderTextColor='gray'
        keyboardType="number-pad"
        value={otp}
        onChangeText={setOtp}
        maxLength={6}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleVerifyOTP}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
      </TouchableOpacity>

   

      <TouchableOpacity style={styles.backButton} onPress={() => setStep('phone')}>
        <Text style={styles.backText}>Change Phone Number</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
          <StatusBar backgroundColor="#ffffff" barStyle="dark-content" />

      <View style={styles.content}>
        {step === 'initial' && renderInitialStep()}
        {step === 'phone' && renderPhoneStep()}
        {step === 'otp' && renderOTPStep()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  stepContainer: { width: '100%' },

  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 40, textAlign: 'center' },

  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },

  googleButtonText: { fontSize: 16, fontWeight: '600', color: '#000' },

  phoneButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  phoneButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },

  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },

  buttonDisabled: { opacity: 0.6 },

  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  resendButton: { alignItems: 'center', marginBottom: 16 },
  resendText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },

  backButton: { alignItems: 'center', marginTop: 16 },
  backText: { color: '#666', fontSize: 14 },
});

export default LoginScreen;
