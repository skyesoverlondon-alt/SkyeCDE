const { KMSClient, EncryptCommand, DecryptCommand } = require("@aws-sdk/client-kms");
const { requireEnv } = require("./_utils");

function kmsClient(){
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  return new KMSClient({ region });
}

async function kmsEncryptToB64(plaintextUtf8, keyId){
  const client = kmsClient();
  const cmd = new EncryptCommand({
    KeyId: keyId,
    Plaintext: Buffer.from(String(plaintextUtf8), "utf8"),
  });
  const out = await client.send(cmd);
  return Buffer.from(out.CiphertextBlob).toString("base64");
}

async function kmsDecryptFromB64(ciphertextB64){
  const client = kmsClient();
  const cmd = new DecryptCommand({
    CiphertextBlob: Buffer.from(String(ciphertextB64), "base64"),
  });
  const out = await client.send(cmd);
  return Buffer.from(out.Plaintext).toString("utf8");
}

function configKmsKeyId(){
  return requireEnv("CONFIG_KMS_KEY_ID");
}

module.exports = {
  kmsEncryptToB64,
  kmsDecryptFromB64,
  configKmsKeyId
};
