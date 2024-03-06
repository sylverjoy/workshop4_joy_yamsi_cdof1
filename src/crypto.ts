import { webcrypto } from "crypto";

// #############
// ### Utils ###
// #############

// Function to convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

// Function to convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  var buff = Buffer.from(base64, "base64");
  return buff.buffer.slice(buff.byteOffset, buff.byteOffset + buff.byteLength);
}

// ################
// ### RSA keys ###
// ################

// Generates a pair of private / public RSA keys
type GenerateRsaKeyPair = {
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
};
export async function generateRsaKeyPair(): Promise<GenerateRsaKeyPair> {
  const keys = webcrypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: { name: "SHA-256" },
    },
    true,
    ["encrypt", "decrypt"]
  );

  return { publicKey: (await keys).publicKey, privateKey: (await keys).privateKey};
}

// Export a crypto public key to a base64 string format
export async function exportPubKey(key: webcrypto.CryptoKey): Promise<string> {

  const exported = await webcrypto.subtle.exportKey("spki", key);
  const exportedKeyBuffer = new Uint8Array(exported);

  const pubKeyString = arrayBufferToBase64(exportedKeyBuffer);
  return pubKeyString;
}

// Export a crypto private key to a base64 string format
export async function exportPrvKey( key: webcrypto.CryptoKey | null ): Promise<string | null> {
  if (key) {
    const exported = await webcrypto.subtle.exportKey("pkcs8", key);
    const exportedKeyBuffer = new Uint8Array(exported);

    const privKeyString = arrayBufferToBase64(exportedKeyBuffer);
    return privKeyString;
  } else {
    return "";
  }
  
}

// Import a base64 string public key to its native format
export async function importPubKey(
  strKey: string
): Promise<webcrypto.CryptoKey> {
  
  const importedKeyBuffer = base64ToArrayBuffer(strKey);

  return webcrypto.subtle.importKey("spki",importedKeyBuffer,{ name: 'RSA-OAEP', hash: 'SHA-256' },true,["encrypt"]);
}

// Import a base64 string private key to its native format
export async function importPrvKey( strKey: string ): Promise<webcrypto.CryptoKey> {
 
  const importedKeyBuffer = base64ToArrayBuffer(strKey);

  return webcrypto.subtle.importKey("pkcs8",importedKeyBuffer,{ name: 'RSA-OAEP', hash: 'SHA-256' },true,["decrypt"]);

}

// Encrypt a message using an RSA public key
export async function rsaEncrypt(
  b64Data: string,
  strPublicKey: string
): Promise<string> {
  // TODO implement this function to encrypt a base64 encoded message with a public key
  // tip: use the provided base64ToArrayBuffer function

  // remove this
  const publicKey   = await importPubKey(strPublicKey);
  const buffer = base64ToArrayBuffer(b64Data);
  const encrypted = await webcrypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      publicKey,
      buffer
    );
    const encryptedBase64 = arrayBufferToBase64(new Uint8Array(encrypted));
    return encryptedBase64;
}

// Decrypts a message using an RSA private key
export async function rsaDecrypt(
  data: string,
  privateKey: webcrypto.CryptoKey
): Promise<string> {
  // TODO implement this function to decrypt a base64 encoded message with a private key
  // tip: use the provided base64ToArrayBuffer function

  // remove this
  const buffer = base64ToArrayBuffer(data);
  const decrypted = await webcrypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    buffer
  );
  const decryptedBase64 = arrayBufferToBase64(new Uint8Array(decrypted));
  return decryptedBase64;
}

// ######################
// ### Symmetric keys ###
// ######################

// Generates a random symmetric key
export async function createRandomSymmetricKey(): Promise<webcrypto.CryptoKey> {
  // TODO implement this function using the crypto package to generate a symmetric key.
  //      the key should be used for both encryption and decryption. Make sure the
  //      keys are extractable.

  // remove this
  const key = await webcrypto.subtle.generateKey(
    {
      name: 'AES-CBC',
      length: 256,
    },
    true, 
    ['encrypt', 'decrypt']
  );

  return key;
}

// Export a crypto symmetric key to a base64 string format
export async function exportSymKey(key: webcrypto.CryptoKey): Promise<string> {
  // TODO implement this function to return a base64 string version of a symmetric key

  // remove this
  const exportedKey = await webcrypto.subtle.exportKey('raw', key);
  const exportedKeyString = arrayBufferToBase64(exportedKey);

  return exportedKeyString;
}

// Import a base64 string format to its crypto native format
export async function importSymKey(
  strKey: string
): Promise<webcrypto.CryptoKey> {
  // TODO implement this function to go back from the result of the exportSymKey function to it's native crypto key object

  // remove this
  const keyBuffer = base64ToArrayBuffer(strKey);
  const importedKey = await webcrypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-CBC', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  return importedKey;
}


// Encrypt a message using a symmetric key
export async function symEncrypt(
  key: webcrypto.CryptoKey,
  data: string
): Promise<string> {
  // TODO implement this function to encrypt a base64 encoded message with a public key
  // tip: encode the data to a uin8array with TextEncoder

  const iv = webcrypto.getRandomValues(new Uint8Array(16));
  const dataBuffer = new TextEncoder().encode(data);
  const encryptedData = await webcrypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    dataBuffer
  );

  const combinedBuffer = new Uint8Array(iv.length + encryptedData.byteLength);
  combinedBuffer.set(iv);
  combinedBuffer.set(new Uint8Array(encryptedData), iv.length);

  const encryptedDataB64 = arrayBufferToBase64(combinedBuffer);

  return encryptedDataB64;
  
}

// Decrypt a message using a symmetric key
export async function symDecrypt(
  strKey: string,
  encryptedData: string
): Promise<string> {
  // TODO implement this function to decrypt a base64 encoded message with a private key
  // tip: use the provided base64ToArrayBuffer function and use TextDecode to go back to a string format

  const key = await importSymKey(strKey);
  const combinedBuffer = base64ToArrayBuffer(encryptedData);
  const iv = combinedBuffer.slice(0, 16);
  const encryptedDataBuffer = combinedBuffer.slice(16);

  const decryptedData = await webcrypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    key,
    encryptedDataBuffer
  );

  const decryptedDataStr = new TextDecoder().decode(new Uint8Array(decryptedData));

  return decryptedDataStr;
}
