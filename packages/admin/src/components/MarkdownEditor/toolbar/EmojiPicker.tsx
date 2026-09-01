import data from '@emoji-mart/data';
import i18n from '@emoji-mart/data/i18n/zh.json';
import Picker from '@emoji-mart/react';

export default function EmojiPicker({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) {
  return (
    <Picker
      i18n={i18n}
      data={data}
      onEmojiSelect={(item: { native?: string }) => {
        if (item?.native) {
          onEmojiSelect(item.native);
        }
      }}
    />
  );
}
