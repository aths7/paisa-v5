
import { auth, firestore } from "@/config/firebase";
import { AuthContextType, UserType } from "@/types";
import { router } from "expo-router";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";


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
                msg = "No user found with this email.";
            } else if (msg.includes("auth/invalid-credential")) {
                msg = "Incorrect Password :-(";
            }
            else if (msg.includes("auth/invalid-email")) {
                msg = "Invalid Email :-(";
            }
            return { success: false, message: msg };
        }
    };
    const register = async (email: string, password: string, name: string) => {
        try {
            let response = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(firestore, "users", response?.user?.uid), {
                name,
                email,
                uid: response?.user?.uid,
                createdAt: new Date(),
            })
            return { success: true };
        } catch (error: any) {
            let msg = error.message || "Login failed";
            if (msg.includes("auth/email-already-in-use")) {
                msg = "This email is already in use.";
            } else if (msg.includes("auth/weak-password")) {
                msg = "Password should be at least 6 characters.";
            }
            else if (msg.includes("auth/invalid-email")) {
                msg = "Invalid Email :-(";
            }
            return { success: false, message: msg };
        }
    };

    const updateUserData = async (uid: string) => {
        try {
            const docRef = doc(firestore, "users", uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const userData: UserType = {
                    uid: data?.uid,
                    name: data.name || null,
                    email: data.email || null,
                    image: data.image || null,
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
