// src/config/firebase.js
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform,PermissionsAndroid, Alert, AppState } from 'react-native';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '758932377277-36v2hq1t1gla0gvib02f8orinhgo11rq.apps.googleusercontent.com',
  offlineAccess: true,
});

// ========== NOTIFICATION HANDLERS ==========
export const requestAndroidNotificationPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );

      console.log("Permission result:", granted);

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
    }
  }
  return true; // For Android < 13
};
// Show local notification in foreground
const showLocalNotification = (title, body, data = {}) => {
  console.log('📢 FOREGROUND NOTIFICATION:', title, body);
  
  Alert.alert(
    title,
    body,
    [
  
      { 
        text: 'OK', 
        style: 'cancel'
      }
    ],
    { cancelable: true }
  );
};

// Setup background handler - REQUIRED for iOS
export const setupBackgroundHandler = () => {
  console.log('🔔 Setting up background message handler...');
  
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('📱 BACKGROUND NOTIFICATION:', remoteMessage);
    return Promise.resolve();
  });
};

// Setup foreground handler - SHOWS NOTIFICATIONS WHEN APP IS OPEN
export const setupForegroundHandler = () => {
  console.log('🔔 Setting up foreground message handler...');
  
  const unsubscribe = messaging().onMessage(async remoteMessage => {
    console.log('📱 FOREGROUND NOTIFICATION RECEIVED:', remoteMessage);
    
    if (remoteMessage.notification) {
      const { title, body } = remoteMessage.notification;
      showLocalNotification(title, body, remoteMessage.data);
    } else if (remoteMessage.data) {
      const { title, body, message } = remoteMessage.data;
      showLocalNotification(
        title || 'New Message',
        body || message || 'You have a new notification',
        remoteMessage.data
      );
    }
  });

  return unsubscribe;
};

// Check initial notification (when app is opened from quit state)
export const checkInitialNotification = async () => {
  try {
    const remoteMessage = await messaging().getInitialNotification();
    if (remoteMessage) {
      console.log('📱 APP OPENED BY NOTIFICATION:', remoteMessage);
      return remoteMessage;
    }
  } catch (error) {
    console.error('Error checking initial notification:', error);
  }
  return null;
};

// Setup notification opened handler
export const setupNotificationOpenedHandler = () => {
  console.log('🔔 Setting up notification opened handler...');
  
  return messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('📱 NOTIFICATION OPENED APP:', remoteMessage);
  });
};

// Initialize all notification handlers
export const initializeNotifications = () => {
  console.log('🔔 INITIALIZING NOTIFICATION HANDLERS...');
  
  // Setup background handler
  setupBackgroundHandler();
  
  // Setup foreground handler
  const unsubscribeForeground = setupForegroundHandler();
  
  // Setup notification opened handler
  const unsubscribeOpened = setupNotificationOpenedHandler();
  
  // Check for initial notification
  checkInitialNotification();
  
  // Return cleanup function
  return () => {
    console.log('🔔 Cleaning up notification handlers...');
    if (unsubscribeForeground) unsubscribeForeground();
    if (unsubscribeOpened) unsubscribeOpened();
  };
};

// Request notification permission
export const requestNotificationPermission = async () => {
  try {
        // ✅ FIRST request Android runtime permission
    await requestAndroidNotificationPermission();
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('🔔 Notification permission granted');
      const token = await getFCMToken();
      return token;
    } else {
      console.log('🔔 Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
};

// Get FCM token
export const getFCMToken = async () => {
  try {
    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }
    
    const token = await messaging().getToken();
    console.log('🔔 FCM TOKEN:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Delete FCM token
export const deleteFCMToken = async () => {
  try {
    await messaging().deleteToken();
    console.log('🔔 FCM token deleted');
  } catch (error) {
    console.error('Error deleting FCM token:', error);
  }
};

// ========== AUTHENTICATION FUNCTIONS ==========

// Store user data in Firestore
export const storeUserData = async (user) => {
  try {
    console.log('🔄 STORING USER DATA IN FIRESTORE...');
    console.log('User UID:', user.uid);

    const userRef = firestore().collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    const isNewUser = !userDoc.exists();
    
    // Get FCM token with proper error handling
    let fcmToken = null;
    try {
      // Request notification permission first
      await requestNotificationPermission();
      fcmToken = await getFCMToken();
    } catch (fcmError) {
      console.warn('FCM token error:', fcmError);
    }

    const userData = {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Unknown User',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      photoURL: user.photoURL || '',
      fcmToken: fcmToken,
      phoneVerified: !!user.phoneNumber,
      lastLogin: firestore.FieldValue.serverTimestamp(),
      providers: user.providerData ? user.providerData.map(provider => provider.providerId) : ['google']
    };

    if (isNewUser) {
      userData.createdAt = firestore.FieldValue.serverTimestamp();
      console.log('📝 Creating NEW user document');
    } else {
      console.log('📝 Updating EXISTING user document');
    }
    
    await userRef.set(userData, { merge: true });
    console.log('✅ User data successfully stored in Firestore');
    
    return userData;
  } catch (error) {
    console.error('❌ Error storing user data:', error);
    throw error;
  }
};

// Google Sign In
export const signInWithGoogle = async () => {
  try {
    console.log('Starting Google Sign-In...');
    
    const hasPlayServices = await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
    
    if (!hasPlayServices) {
      throw new Error('Google Play Services not available');
    }

    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken;
    
    if (!idToken) {
      throw new Error('No ID token received from Google Sign-In');
    }

    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    const userCredential = await auth().signInWithCredential(googleCredential);
    
    console.log('Firebase auth successful, storing user data...');
    
    // Initialize notifications after sign in
    initializeNotifications();
    
    const storedUser = await storeUserData(userCredential.user);
    console.log('✅ User data storage verified:', storedUser.uid);
    
    return userCredential;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

// Phone authentication functions
export const sendOTP = async (phoneNumber) => {
  try {
    console.log('Sending OTP to:', phoneNumber);
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    console.log('OTP sent successfully');
    return confirmation;
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
};

// Verify OTP
export const verifyOTP = async (confirmation, otp, currentUser) => {
  try {
    console.log('🔍 DEBUG verifyOTP - START');
    
    if (!currentUser) {
      throw new Error('No user found. Please sign in with Google first.');
    }

    const phoneCredential = auth.PhoneAuthProvider.credential(
      confirmation.verificationId,
      otp
    );
    
    try {
      await currentUser.linkWithCredential(phoneCredential);
      console.log('✅ Phone number successfully linked to Google account');
    } catch (linkError) {
      console.error('❌ Link error:', linkError);
      
      if (linkError.code === 'auth/requires-recent-login') {
        throw new Error('Session expired. Please sign in with Google again.');
      }
      throw linkError;
    }
    
    const updatedUserData = {
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      email: currentUser.email,
      phoneNumber: currentUser.phoneNumber,
      phoneVerified: true,
      lastLogin: firestore.FieldValue.serverTimestamp(),
      providers: currentUser.providerData.map(provider => provider.providerId)
    };
    
    const userRef = firestore().collection('users').doc(currentUser.uid);
    await userRef.set(updatedUserData, { merge: true });
    
    console.log('✅ User data updated in Firestore');
    return updatedUserData;
  } catch (error) {
    console.error('❌ Error in verifyOTP:', error);
    throw error;
  }
};

// Check if phone number exists
export const checkIfPhoneNumberExists = async (phoneNumber) => {
  try {
    console.log('Checking if phone number exists:', phoneNumber);
    
    const usersSnapshot = await firestore()
      .collection('users')
      .where('phoneNumber', '==', phoneNumber)
      .get();
    
    const exists = !usersSnapshot.empty;
    console.log('Phone number exists:', exists);
    
    return exists;
  } catch (error) {
    console.error('Error checking phone number:', error);
    return false;
  }
};

// Subscribe to users
export const subscribeToUsers = (callback, currentUserId = null) => {
  console.log('Setting up users subscription...');
  
  return firestore()
    .collection('users')
    .onSnapshot(
      (snapshot) => {
        const users = [];
        const seenUIDs = new Set();
        
        snapshot.forEach(doc => {
          const userData = doc.data();
          
          if (userData.uid && userData.displayName && (userData.email || userData.phoneNumber)) {
            if (userData.uid !== currentUserId) {
              if (!seenUIDs.has(userData.uid)) {
                seenUIDs.add(userData.uid);
                users.push({ 
                  id: doc.id, 
                  ...userData 
                });
              }
            }
          }
        });
        
        console.log('Users subscription - Valid unique users:', users.length);
        callback(users);
      }, 
      (error) => {
        console.error('Error in users subscription:', error);
        callback([]);
      }
    );
};

// Fix user data
export const fixUserData = async (user) => {
  try {
    console.log('🔄 Force fixing user data for:', user.uid);
    
    const userRef = firestore().collection('users').doc(user.uid);
    
    const userData = {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Unknown User',
      email: user.email || '',
      photoURL: user.photoURL || '',
      lastLogin: firestore.FieldValue.serverTimestamp(),
    };

    const docSnap = await userRef.get();
    if (!docSnap.exists()) {
      userData.createdAt = firestore.FieldValue.serverTimestamp();
    }

    await userRef.set(userData, { merge: true });
    console.log('✅ User data fixed successfully');
    return userData;
  } catch (error) {
    console.error('Error fixing user data:', error);
    throw error;
  }
};

// Clean up duplicate user documents
export const removeDuplicateUsers = async () => {
  try {
    console.log('🔄 Removing duplicate user documents...');
    
    const usersSnapshot = await firestore().collection('users').get();
    const usersByUID = new Map();
    const duplicateDocs = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const uid = userData.uid;
      
      if (!uid) {
        duplicateDocs.push(doc.id);
        return;
      }
      
      if (usersByUID.has(uid)) {
        const existing = usersByUID.get(uid);
        
        if (doc.id === uid) {
          duplicateDocs.push(existing.docId);
          usersByUID.set(uid, { docId: doc.id, data: userData });
        } else {
          duplicateDocs.push(doc.id);
        }
      } else {
        usersByUID.set(uid, { docId: doc.id, data: userData });
      }
    });
    
    console.log(`Found ${duplicateDocs.length} duplicate documents`);
    for (const docId of duplicateDocs) {
      await firestore().collection('users').doc(docId).delete();
    }
    
    console.log('✅ Duplicate cleanup complete');
    return {
      duplicatesRemoved: duplicateDocs.length,
      uniqueUsers: usersByUID.size
    };
  } catch (error) {
    console.error('Error removing duplicates:', error);
    throw error;
  }
};

// Initialize notifications when this module is imported
console.log('🔔 FIREBASE MODULE LOADED - INITIALIZING NOTIFICATIONS');
initializeNotifications();

export { auth, firestore, messaging };