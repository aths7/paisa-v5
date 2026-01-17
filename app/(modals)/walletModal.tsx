import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useState } from "react";
import ScreenWrapper from "@/components/ScreenWrapper";
import ModalWrapper from "@/components/ModalWrapper";
import Typo from "@/components/Typo";
import Header from "@/components/Header";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Button from "@/components/Button";
import Input from "@/components/Input";
import ImageUpload from "@/components/ImageUpload";
import { scale, verticalScale } from "@/utils/styling";
import { createOrUpdateWallet, deleteWallet } from "@/services/walletService";
import { useAuth } from "@/contexts/authContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WalletType } from "@/types";
import BackButton from "@/components/BackButton";
import * as Icons from "phosphor-react-native";

const WalletModal = () => {
  const [wallet, setWallet] = useState<WalletType>({
    name: "",
    image: null,
  });
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const oldWallet: { name: string; image: string; id?: string } =
    useLocalSearchParams();
  // console.log("params: ", oldWallet);

  useEffect(() => {
    if (oldWallet?.id) {
      setWallet({
        name: oldWallet.name,
        image: oldWallet?.image || null,
      });
    }
  }, []);

  const onSelectImage = (file: any) => {
    // console.log("file: ", file);
    if (file) setWallet({ ...wallet, image: file });
  };

  const onSubmit = async () => {
    let { name, image } = wallet;

    if (loading) return;
    if (!name.trim() || !image) {
      Alert.alert("Wallet", "Please fill all the fields!");
      return;
    }

    setLoading(true);
    let data: WalletType = {
      name,
      image,
      uid: user?.uid,
    };
    if (oldWallet.id) data.id = oldWallet.id;

    const res = await createOrUpdateWallet(data);
    setLoading(false);
    console.log("res: ", res);
    if (res.success) {
      router.back();
    } else {
      Alert.alert("Wallet", res.msg);
    }
  };

  const onDelete = async () => {
    if (!oldWallet?.id) return;
    setLoading(true);
    const res = await deleteWallet(oldWallet.id as string);
    setLoading(false);

    if (res.success) {
      router.back();
    } else {
      Alert.alert("Wallet", res.msg);
    }
  };

  const showDeleteAlert = () => {
    Alert.alert(
      "Confirm",
      "Are you sure you want to do this?\nThis will remove all the transactions related to this wallet!",
      [
        {
          text: "Cancel",
          onPress: () => console.log("Cancel delete"),
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: () => onDelete(),
          style: "destructive",
        },
      ]
    );
  };

  // console.log("wallet here: ", wallet);

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={oldWallet?.id ? "Updated Wallet" : "New Wallet"}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />
        {/* form */}
        <ScrollView contentContainerStyle={styles.form}>
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200}>Wallet Name</Typo>
            <Input
              placeholder="Salary"
              value={wallet.name}
              onChangeText={(value) => setWallet({ ...wallet, name: value })}
            />
          </View>
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200}>Wallet Icon</Typo>
            <ImageUpload
              file={wallet.image}
              onSelect={onSelectImage}
              onClear={() => setWallet({ ...wallet, image: null })}
              placeholder="Upload Image"
            />
          </View>
        </ScrollView>
      </View>

      {/* footer */}
      <View style={styles.footer}>
        {oldWallet?.id && !loading && (
          <Button
            style={{
              backgroundColor: colors.rose,
              paddingHorizontal: spacingX._15,
            }}
            onPress={showDeleteAlert}
          >
            <Icons.Trash
              color={colors.white}
              size={verticalScale(24)}
              weight="bold"
            />
          </Button>
        )}
        <Button onPress={onSubmit} loading={loading} style={{ flex: 1 }}>
          <Typo color={colors.black} fontWeight={"700"} size={18}>
            {oldWallet?.id ? "Update Wallet" : "Add Wallet"}
          </Typo>
        </Button>
      </View>
    </ModalWrapper>
  );
};

export default WalletModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingY._20,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacingX._20,
    gap: scale(12),
    paddingTop: spacingY._15,
    borderTopColor: colors.neutral700,
    marginBottom: spacingY._5,
    borderTopWidth: 1,
  },
  form: {
    gap: spacingY._20,
    paddingVertical: spacingY._15,
    paddingBottom: spacingY._40,
  },
  inputContainer: {
    gap: spacingY._10,
  },
});
