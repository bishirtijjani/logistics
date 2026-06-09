import React, { forwardRef, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useTheme } from '../theme';

const AppBottomSheet = forwardRef(({ children, snapPoints = ['25%', '50%'], onClose }, ref) => {
  const { tokens } = useTheme();
  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onChange={(index) => {
        if (index === -1 && onClose) onClose();
      }}
      backgroundStyle={{ backgroundColor: tokens.bg.surface, borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: tokens.border.default, width: 40 }}
    >
      <View style={{ flex: 1, padding: 24, backgroundColor: tokens.bg.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
        {children}
      </View>
    </BottomSheet>
  );
});

export default AppBottomSheet;
