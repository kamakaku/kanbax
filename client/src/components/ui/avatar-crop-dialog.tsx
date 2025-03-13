import { useState } from "react";
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedImage: Blob) => void;
}

export function AvatarCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 100,
    height: 100,
    x: 0,
    y: 0,
    aspect: 1
  });

  const onCropChange = (newCrop: Crop) => {
    setCrop(newCrop);
  };

  const getCroppedImg = async (
    image: HTMLImageElement,
    crop: Crop
  ): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg');
    });
  };

  const handleComplete = async () => {
    const image = document.querySelector('.ReactCrop__image') as HTMLImageElement;
    if (!image) return;

    try {
      const croppedImage = await getCroppedImg(image, crop);
      onCropComplete(croppedImage);
      onOpenChange(false);
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Profilbild zuschneiden</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <ReactCrop
            crop={crop}
            onChange={onCropChange}
            aspect={1}
            className="max-h-[60vh]"
          >
            <img src={imageSrc} alt="Zu bearbeitendes Profilbild" />
          </ReactCrop>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleComplete}>
            Auswahl übernehmen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
