import BackButton from '@/components/BackButton'
import Button from '@/components/Button'
import Input from '@/components/Input'
import ScreenWrapper from '@/components/ScreenWrapper'
import Typo from '@/components/Typo'
import { colors, spacingX, spacingY } from '@/constants/theme'
import { useAuth } from '@/contexts/authContext'
import { verticalScale } from '@/utils/styling'
import { useRouter } from 'expo-router'
import * as Icons from 'phosphor-react-native'
import React, { useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'


const Login = () => {
    const emailRef = useRef("");
    const passwordRef = useRef("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { login: loginUser } = useAuth();


    const handleSubmit = async () => {
        if (!emailRef.current || !passwordRef.current) {
            Alert.alert("Please fill in all fields");
            return;
        }
        setIsLoading(true);
        const res = await loginUser(
            emailRef.current,
            passwordRef.current
        );
        setIsLoading(false);
        console.log("login response", res);
        if (!res.success) {
            Alert.alert("Login Failed", res.message || "An error occurred during login");
            return;
        }
    }

    return (
        <ScreenWrapper>
            <View style={styles.container}>
                <BackButton iconSize={28} />
                <View style={{ gap: 5, marginTop: spacingY._20 }}>
                    <Typo size={30} fontWeight="800">
                        Hey,
                    </Typo>
                    <Typo size={30} fontWeight="800">
                        Welcome Back!
                    </Typo>
                </View>
                {/* login form */}
                <View style={styles.form}>
                    <Typo size={16} color={colors.textLighter}> Login now to  track all your expenses </Typo>
                    <Input
                        placeholder='Enter your email'
                        onChangeText={(value) => (emailRef.current = value)}
                        icon={<Icons.AtIcon size={verticalScale(26)}
                            color={colors.neutral300}
                            weight='fill' />} />
                    <Input
                        placeholder='Enter your password'
                        secureTextEntry
                        onChangeText={(value) => (passwordRef.current = value)}
                        icon={<Icons.LockIcon size={verticalScale(26)}
                            color={colors.neutral300}
                            weight='fill' />} />
                    <Typo size={14} style={styles.forgotPassword}>Forgot Password ?</Typo>
                    <Button loading={isLoading} onPress={handleSubmit} >
                        <Typo size={21} fontWeight={'600'} color={colors.black}>Login</Typo>
                    </Button>
                </View>
                {/* footer */}
                <View style={styles.footer}>
                    <Typo style={styles.footerText}>Don&apos;t have an account?</Typo>
                    <Pressable onPress={() => { router.navigate('/(auth)/register') }}>
                        <Typo size={15} fontWeight={'700'} color={colors.primary}> Sign Up</Typo>
                    </Pressable>

                </View>
            </View>
        </ScreenWrapper>
    )
}

export default Login

const styles = StyleSheet.create({
    container: {
        flex: 1,
        gap: spacingY._30,
        paddingHorizontal: spacingX._20
    },
    welcomeText: {
        fontSize: verticalScale(20),
        fontWeight: "bold",
        color: colors.text,
    },
    form: {
        gap: spacingY._20,
    },
    forgotPassword: {
        textAlign: 'right',
        fontWeight: '500',
        color: colors.text,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
    },
    footerText: {
        textAlign: 'center',
        color: colors.text,
        fontSize: verticalScale(15),
    }
})