// ==========================================
// FILE: chat/cloud-media.js
// FUNGSI: Transmisi Media Awan (Cloudinary) Murni
// ==========================================
const CLOUDINARY_CLOUD_NAME = "wuw7hvjo"; 
const CLOUDINARY_UPLOAD_PRESET = "bagantara-chat"; // Pastikan preset ini disetting bertipe 'Unsigned' di Cloudinary

export async function uploadMediaKeCloudinary(fileBlob, tipeData = 'image') {
    const formData = new FormData();
    formData.append('file', fileBlob);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const endpointTipe = tipeData === 'audio' ? 'video' : 'image';
    const apiUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${endpointTipe}/upload`;

    try {
        const respon = await fetch(apiUrl, { method: 'POST', body: formData });
        if (!respon.ok) throw new Error("Gagal mengunggah media");
        const data = await respon.json();
        return data.secure_url; 
    } catch (error) {
        console.error("[MODUL MEDIA] Kegagalan transmisi Cloudinary:", error);
        return null;
    }
}
