
import { auth, firestore } from "@/config/firebase";
import { AuthContextType, UserType } from "@/types";
import { router } from "expo-router";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { deriveKey, encryptField, decryptField, isEncrypted } from "@/services/encryptionService";


const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserType>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {

            console.log("Auth state changed. User:", firebaseUser);
            if (firebaseUser) {
                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: firebaseUser.displayName,
                });
                updateUserData(firebaseUser.uid);
                router.replace("/(tabs)");
            } else {
                setUser(null);
                router.replace("/(auth)/welcome");
            }
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            return { success: true };
        } catch (error: any) {
            let msg = error.message || "Login failed";
            if (msg.includes("auth/user-not-found")) {
                msg = "No account found with this email.";
            } else if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")) {
                msg = "Incorrect email or password.";
            } else if (msg.includes("auth/invalid-email")) {
                msg = "Please enter a valid email address.";
            } else if (msg.includes("auth/too-many-requests")) {
                msg = "Too many failed attempts. Please try again later or reset your password.";
            } else if (msg.includes("auth/network-request-failed")) {
                msg = "Network error. Please check your connection and try again.";
            } else if (msg.includes("auth/user-disabled")) {
                msg = "This account has been disabled. Please contact support.";
            }
            return { success: false, msg };
        }
    };
    const register = async (email: string, password: string, name: string) => {
        try {
            let response = await createUserWithEmailAndPassword(auth, email, password);
            const uid = response?.user?.uid;
            const key = deriveKey(uid);
            await setDoc(doc(firestore, "users", uid), {
                name: encryptField(name, key),
                email,
                uid,
                createdAt: new Date(),
            })
            return { success: true };
        } catch (error: any) {
            let msg = error.message || "Registration failed";
            if (msg.includes("auth/email-already-in-use")) {
                msg = "An account with this email already exists.";
            } else if (msg.includes("auth/weak-password")) {
                msg = "Password should be at least 6 characters.";
            } else if (msg.includes("auth/invalid-email")) {
                msg = "Please enter a valid email address.";
            } else if (msg.includes("auth/network-request-failed")) {
                msg = "Network error. Please check your connection and try again.";
            }
            return { success: false, msg };
        }
    };

    const updateUserData = async (uid: string) => {
        try {
            const docRef = doc(firestore, "users", uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const key = deriveKey(uid);
                let displayName = data.name || null;
                if (isEncrypted(displayName)) {
                    try {
                        displayName = decryptField(displayName, key);
                    } catch {
                        // Leave as-is on failure
                    }
                }
                const userData: UserType = {
                    uid,
                    name: displayName,
                    email: data.email || null,
                    image: data.image || null,
                    emotionTags: data.emotionTags || [],
                    emotionColors: data.emotionColors || {},
                    expenseCategories: data.expenseCategories || [],
                };
                setUser({ ...userData });
            }


        } catch (error: any) {
            let msg = error.message || "Updating user data failed";
            // return { success: false, message: msg };   
            console.log("error message", msg);
        }
    }

    const contextValue: AuthContextType = {
        user,
        setUser,
        login,
        register,
        updateUserData,
    };
    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );

};


export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
