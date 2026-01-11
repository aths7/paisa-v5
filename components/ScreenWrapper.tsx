import { colors } from '@/constants/theme';
import { ScreenWrapperProps } from '@/types';
import React from 'react';
import { Dimensions, Platform, StatusBar, View } from 'react-native';

const { height } = Dimensions.get('window');

const ScreenWrapper = ({ style, children }: ScreenWrapperProps) => {
    let paddingTop = Platform.OS === "ios" ? height * 0.06 : 50;
    return (
        <View style={[{
            paddingTop,
            flex: 1,
            backgroundColor: colors.neutral900
        }, style]}>
            <StatusBar barStyle="light-content" />
            {children}
        </View>
    )
}

export default ScreenWrapper

