import Button from '@/components/Button'
import ScreenWrapper from '@/components/ScreenWrapper'
import Typo from '@/components/Typo'
import { auth } from '@/config/firebase'
import { colors } from '@/constants/theme'
import { useAuth } from '@/contexts/authContext'
import { signOut } from 'firebase/auth'
import React from 'react'
import { StyleSheet, View } from 'react-native'

const Home = () => {
    const { user } = useAuth();
    console.log("current user in home screen", user);

    const handleLogout = async () => {
        await signOut(auth);

    }
    return (
        <ScreenWrapper>
            <View>
                <Typo>Home</Typo>
                <Button onPress={handleLogout}>
                    <Typo color={colors.black}>Log out</Typo>
                </Button>
            </View>
        </ScreenWrapper>
    )
}

export default Home

const styles = StyleSheet.create({})