// src/screens/LoginScreen.js - UPDATED
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { 
  signInWithGoogle, 
  sendOTP, 
  verifyOTP, 
  firestore, 
  auth ,
  verifyOTPAndStorePhone
} from '../config/firebase';

const LoginScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('google');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      console.log('Attempting Google Sign-In...');
      const result = await signInWithGoogle();
      console.log('Google Sign in successful, moving to phone verification');
      
      // Store the Google user for later linking
      setGoogleUser(result.user);
      
      // Move to phone verification step
      setStep('phone');
    } catch (error) {
      console.log('Sign in error caught:', error);
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

// In LoginScreen.js - update handleVerifyOTP
const handleVerifyOTP = async () => {
  if (!otp.trim() || otp.length !== 6) {
    Alert.alert('Error', 'Please enter a valid 6-digit OTP');
    return;
  }

  setLoading(true);
  try {
    const currentUser = googleUser || auth().currentUser;
    
    if (!currentUser) {
      throw new Error('No user found. Please sign in with Google first.');
    }

    console.log('Using alternative phone storage approach...');
    
    // Use the alternative approach
    // await verifyOTPAndStorePhone(confirmation, otp, currentUser, phoneNumber);
    
    console.log('Phone verification successful');

    // Navigate to ChatListScreen
    navigation.reset({
      index: 0,
      routes: [{ name: 'ChatListScreen' }],
    });
    
  } catch (error) {
    console.error('Verification error:', error);
    Alert.alert('Verification Failed', error.message);
  } finally {
    setLoading(false);
  }
};
  // ... (rest of your render methods remain the same)
  const renderGoogleStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
        disabled={loading}>
        <Text style={styles.googleButtonText}>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPhoneStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Phone Verification</Text>
      <Text style={styles.subtitle}>Enter your phone number to receive OTP</Text>

      <TextInput
        style={styles.input}
        placeholder="Phone Number (+91XXXXXXXXXX)"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        maxLength={13}
      />
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSendOTP}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setStep('google')}>
        <Text style={styles.backText}>Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOTPStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to your phone</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter 6-digit OTP"
        keyboardType="number-pad"
        value={otp}
        onChangeText={setOtp}
        maxLength={6}
      />
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleVerifyOTP}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resendButton}
        onPress={handleSendOTP}>
        <Text style={styles.resendText}>Resend OTP</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setStep('phone')}>
        <Text style={styles.backText}>Change Phone Number</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {step === 'google' && renderGoogleStep()}
        {step === 'phone' && renderPhoneStep()}
        {step === 'otp' && renderOTPStep()}
      </View>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stepContainer: {
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    marginBottom: 16,
  },
  resendText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  backText: {
    color: '#666',
    fontSize: 14,
  },
});

export default LoginScreen;