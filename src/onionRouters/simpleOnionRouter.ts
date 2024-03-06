import bodyParser from "body-parser";
import express from "express";
import axios from "axios";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import * as crypto from "../crypto";

export async function simpleOnionRouter(nodeId: number) {
  const { publicKey, privateKey } = await crypto.generateRsaKeyPair();
  const publicKeyString = await crypto.exportPubKey(publicKey);
  const privateKeyString = await crypto.exportPrvKey(privateKey);
  
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;
  let lastMessageSource: number | null = null;

  async function sendMessageToTheNextNode(lastMessageDestination:number | null) {
    await fetch(`http://localhost:${lastMessageDestination}/message`, {
      method: "POST",
      body: JSON.stringify({ message: lastReceivedDecryptedMessage }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });

  onionRouter.get("/getPrivateKey", (req, res) => {
    res.json({ result: privateKeyString });
  });

  onionRouter.post("/message", async (req, res) => {
    const outputLayer = req.body.message;

    const encryptedSymKey = outputLayer.slice(0, 344);
    const symKey = await crypto.rsaDecrypt(encryptedSymKey, privateKey);

    const encryptedMessage = outputLayer.slice(344);
    const message = await crypto.symDecrypt(symKey, encryptedMessage);

    lastReceivedEncryptedMessage = outputLayer;
    lastReceivedDecryptedMessage = message ? message.slice(10) : null;
    lastMessageSource = nodeId;
    lastMessageDestination = message ? parseInt(message.slice(0, 10), 10) : null;
    
    await sendMessageToTheNextNode(lastMessageDestination);
    
    res.send("success");
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, async () => {
    console.log(`Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`);

    await registerNodeOnRegistry(nodeId, publicKeyString);
  });

  return server;
}

async function registerNodeOnRegistry(nodeId: number, publicKey: string) {
  try {
    const response = await axios.post(`http://localhost:${REGISTRY_PORT}/registerNode`, {
      nodeId: nodeId,
      pubKey: publicKey,
    });

    console.log(`Node ${nodeId} registered successfully on the registry. Response:`, response.data);
  } 
  catch (error) {
    console.error(`Error registering node ${nodeId} on the registry`);
  }
}