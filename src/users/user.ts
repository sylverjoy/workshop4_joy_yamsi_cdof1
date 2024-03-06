import bodyParser from "body-parser";
import express from "express";
import { Node } from "../registry/registry";
import * as crypto from "../crypto";
import { GetNodeRegistryBody } from "../../src/registry/registry";
import { BASE_USER_PORT, REGISTRY_PORT, BASE_ONION_ROUTER_PORT } from "../config";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());


  let lastSentMessage: string | null = null;
  let lastReceivedMessage: string | null = null;
  let lastCircuit: Node[] = [];

  async function getNodeRegistry() {
    const nodes = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`)
      .then((res) => res.json() as Promise<GetNodeRegistryBody>)
      .then((json) => json.nodes);
  
    return nodes;
  }

  async function sendMessageToTheFirstNode(messageToSend:string, entryNode:Node) {
    await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + entryNode.nodeId}/message`, {
      method: "POST",
      body: JSON.stringify({ message: messageToSend }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  _user.get("/status", (req, res) => {
    res.send("live");
  });

  _user.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
  });

  _user.get("/getLastReceivedMessage", (req, res) => {
    if (lastReceivedMessage == null) {
      res.json({ result: null });
    } else {
      res.json({ result: lastReceivedMessage });
    }
  });

  _user.post("/message", (req, res) => {
    const { message }: SendMessageBody = req.body;
    lastReceivedMessage = message;
    res.send("success");
  });

  _user.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body;
    let nodeCircuit: Node[] = [];

    const nodes = await getNodeRegistry();

    while (nodeCircuit.length < 3 && nodes.length > 0) {
      const randomIndex = Math.floor(Math.random() * nodes.length);
      const randomNode = nodes[randomIndex];
    
      if (!nodeCircuit.includes(randomNode)) {
        nodeCircuit.push(randomNode);
      }
    
      nodes.splice(randomIndex, 1);
    }

    lastSentMessage = message;
    let messageToSend = message;
    let destination = '000000' + (BASE_USER_PORT + destinationUserId).toString();

    for (let i = 0; i < nodeCircuit.length; i++) {
      const node = nodeCircuit[i];
      const symKey = await crypto.createRandomSymmetricKey();
      const messageToEncrypt = (destination + messageToSend).toString();
      destination = "000000" + (BASE_ONION_ROUTER_PORT + node.nodeId).toString();
      const encryptedMessage = await crypto.symEncrypt(symKey, messageToEncrypt);
      const encryptedSymKey = await crypto.rsaEncrypt(await crypto.exportSymKey(symKey), node.pubKey);
      messageToSend = encryptedSymKey + encryptedMessage;
    }

    nodeCircuit.reverse();

    const entryNode = nodeCircuit[0];
    lastCircuit = nodeCircuit;
    await sendMessageToTheFirstNode(messageToSend, entryNode);
    
    res.send("success");
  });

  _user.get("/getLastCircuit", async  (req, res) => {
    res.json({ result: lastCircuit.map((node) => node.nodeId) });
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(`User ${userId} is listening on port ${BASE_USER_PORT + userId}`);
  });

  return server;
}