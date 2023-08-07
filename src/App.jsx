import {useEffect, useRef, useState} from 'react'
import { SignClient } from '@walletconnect/sign-client';
import { Web3Modal } from '@web3modal/standalone';
import './App.css'

import { makeSignDoc as makeAminoSignDoc } from "@cosmjs/amino"
import { encodePubkey, Registry, makeAuthInfoBytes } from "@cosmjs/proto-signing";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { createDefaultAminoConverters, defaultRegistryTypes, AminoTypes, calculateFee, GasPrice } from "@cosmjs/stargate";
import { Int53 } from "@cosmjs/math";
import { fromBase64 } from "@cosmjs/encoding";
import { FinschiaClient } from "@finschia/finschia";

// Your dapp's Project ID from https://cloud.walletconnect.com/
const WC_PROJECT_ID = '9e1152b9dc0318eea105dc31238fbc00';
const CHAIN_ID = 'finschia-2';

// https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md
const CAIP_BLOCKCHAIN_ID = `cosmos:${CHAIN_ID}`

const LCD_ENDPOINT= 'https://dsvt-finschianw.line-apps.com'
const API_ENDPOINT = 'https://dsvt-finschianw-api.line-apps.com'
// const LOCALHOST = 'http://localhost:1317'

const aminoTypes = new AminoTypes(createDefaultAminoConverters());
const registry = new Registry(defaultRegistryTypes);

const web3modal = new Web3Modal({
    walletConnectVersion: 2,
    projectId: WC_PROJECT_ID,
    standaloneChains: [CAIP_BLOCKCHAIN_ID]
});

function initSignClient() {
    const [uri, setUri] = useState('')
    const [address, setAddress] = useState(null);
    const [session, setSession] = useState(null);
    const signClient = useRef(null)

    useEffect(() => {
        (async () => {
            const result =  await SignClient.init({
                projectId: WC_PROJECT_ID,
                metadata: {
                    name: "WC2 dApp",
                    description: "WalletConnect v2 Dapp Example for DOSI Vault Extension",
                    url: "https://dapp.example.com",
                    icons: ["https://i.pinimg.com/600x315/93/3e/14/933e14abb0241584fd6d5a31bea1ce7b.jpg"],
                },
            })
            signClient.current = result
            signClient.current.on("session_delete", () => {
                window.location.reload();
            });
            const { uri, approval }  = await signClient.current.connect({});
            setUri(uri)
            const wcSession = await approval();
            web3modal.closeModal();
            setSession(wcSession);
            const bech32 = parseAccount(wcSession.namespaces.cosmos.accounts[0]).bech32;
            console.log(wcSession.namespaces.cosmos.accounts[0]);
            setAddress(bech32);
        })();
    }, [])

    return {
        uri,
        address,
        session,
        signClient: signClient.current
    }
}


function parseAccount(account) {
    // example `cosmos:finschia-beta-2:link1a509xf4stwa9yaec5vu64fcem5zeyc3t7t47fc`
    const parts = account.split(':');
    return {
        ns: parts[0],
        chainId: parts[1],
        bech32: parts[2]
    }
}

function getProtoTxFromAmino(aminoPubkey, signed, signature){
    const txBody = {
        typeUrl: "/cosmos.tx.v1beta1.TxBody",
        value: {
            messages: signed.msgs.map((msg) => aminoTypes.fromAmino(msg)),
            memo: signed.memo,
        },
    };
    const txBodyBytes = registry.encode(txBody);

    const gasLimit = Int53.fromString(signed.fee.gas).toNumber();
    const sequence = Int53.fromString(signed.sequence).toNumber();
    const authInfoBytes = makeAuthInfoBytes(
        [{ pubkey: encodePubkey(aminoPubkey), sequence }],
        signed.fee.amount,
        gasLimit,
        signed.fee.granter,
        signed.fee.payer,
        SignMode.SIGN_MODE_LEGACY_AMINO_JSON,
    );

    const txRaw = TxRaw.fromPartial({
        bodyBytes: txBodyBytes,
        authInfoBytes: authInfoBytes,
        signatures: [fromBase64(signature)],
    });
    const txBytes = TxRaw.encode(txRaw).finish();
    return txBytes;
}


function App() {
    const [sendAmount, setSendAmount] = useState('0');
    const [msgToSign, setMsgToSign] = useState(null);
    const [signature, setSignature] = useState(null);
    const [signed, setSigned] = useState(null);
    const [aminoPubkey, setAminoPubkey] = useState(null);
    const [dynamicLinkBase, setDynamicLinkBase] = useState("https://dosivault.page.link/qL6j");

    const { uri, signClient, address, session } = initSignClient()

    async function showQRCodeModal() {
        web3modal.openModal({uri});
    }

    function getDynamicLinkUrl(wcUrl) {
        const encodedUrl = encodeURIComponent(wcUrl);
        return `${dynamicLinkBase}?uri_wc=${encodedUrl}`;
    }

    async function handleSignArbitraryMsg() {
        const url = `${LCD_ENDPOINT}/cosmos/auth/v1beta1/accounts/${address}`;
        const accountResponse = await fetch(url);
        const accountData = await accountResponse.json();
        const sequence = accountData.account.sequence;
        const accountNumber = accountData.account.account_number;

        // with amino signing
        {
            const sendMsg = {
                type: "cosmos-sdk/MsgSend",
                value: {
                  amount: [
                    {
                      amount: sendAmount,
                      denom: 'cony',
                    },
                  ],
                  from_address: address,
                  to_address: address,
                },
              };

            const gasPrice = GasPrice.fromString("0.025cony");
            const gasLimit = 100_000;
            const fee = calculateFee(gasLimit, gasPrice)
            
            const signDoc = makeAminoSignDoc([sendMsg], fee, CHAIN_ID, "test", accountNumber, sequence);
            setMsgToSign(JSON.stringify(signDoc, null, 2));

            const params = {
                signerAddress: address,
                signDoc: signDoc
            }
            const resp = await signClient.request({
                topic: session.topic,
                chainId: CAIP_BLOCKCHAIN_ID,
                request: {
                    method: "cosmos_signAmino",
                    params: params
                },
            });

            setSignature(resp.signature.signature);
            setAminoPubkey(resp.signature.pub_key);
            setSigned(resp.signed);
        }
    }

    async function handleBroadcastClicked(){
        const txBytes = getProtoTxFromAmino(aminoPubkey, signed, signature);

        const client = await FinschiaClient.connect(API_ENDPOINT);
        const result = await client.broadcastTx(txBytes);
        console.log(result);
    }

    return (
        <div className="App">
            <div>
                <img src="https://i.pinimg.com/600x315/93/3e/14/933e14abb0241584fd6d5a31bea1ce7b.jpg"></img>
            </div>
            <h1>dApp Example</h1>
            <h2>WalletConnect v2 + Vault</h2>
            <div>WC URI: {uri}</div>
            
            <div className="card">
                <div hidden={!!address}>
                    <div>
                        {
                            uri ? (
                                <button onClick={showQRCodeModal}>
                                    Connect (QR Modal)
                                </button>
                            ) : null
                        }
                    </div>
                    <div>
                        {
                            uri ? (<a href={getDynamicLinkUrl(uri)}>Dynamic link</a>) : null
                        }
                        
                    </div>
                </div>
                <div hidden={!address}>
                    Address: {address}

                    <div style={{borderBlock: "1px dotted"}}>
                        Message to sign :
                        <input value={sendAmount} onChange={e => setSendAmount(e.target.value)}/>
                        <button onClick={handleSignArbitraryMsg}>
                            Off-chain sign
                        </button>
                        <a href={getDynamicLinkUrl(uri)}>
                            Bring Vault to front
                        </a>
                        <div>
                            Msg to Sign: <p>{msgToSign}</p>
                        </div>
                        <div>
                            Signature: <p>{signature}</p>
                        </div>
                        <div hidden={!signature}>
                            <button onClick={handleBroadcastClicked}>
                                Broadcast
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <footer>
                <h3>
                    <a href='https://github.com/dosivault/wc_v2_example'>Source code</a>
                </h3>
                <div className='card'>
                    <label>Dynamic link base</label>
                    <input  type="url" value={dynamicLinkBase} onChange={ e=> setDynamicLinkBase(e.target.value) } />
                </div>
            </footer>
        </div>
    )
}

export default App
