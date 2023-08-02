import {useEffect, useRef, useState} from 'react'
import { SignClient } from '@walletconnect/sign-client';
import { Web3Modal } from '@web3modal/standalone';
import './App.css'

import { makeSignDoc as makeAminoSignDoc} from "@cosmjs/amino"

// Your dapp's Project ID from https://cloud.walletconnect.com/
const WC_PROJECT_ID = '9e1152b9dc0318eea105dc31238fbc00';
const CHAIN_ID = 'finschia-2';

// https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md
const CAIP_BLOCKCHAIN_ID = `cosmos:${CHAIN_ID}`

const LCD_ENDPOINT= 'https://dsvt-finschia.line-apps.com'
// const LOCALHOST = 'http://localhost:1317'

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

function App() {
    const [sendAmount, setSendAmount] = useState('0');
    const [msgToSign, setMsgToSign] = useState(null);
    const [signature, setSignature] = useState(null);
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

            const gasPrice = {amount: "0.025", denom: 'cony'}
            const gasLimit = '100000';
            const fee = {
                amount: [gasPrice],
                gas: gasLimit,
              };
            
            const signDoc = makeAminoSignDoc([sendMsg], fee, CHAIN_ID, "test", accountNumber, sequence);

            const params = {
                signerAddress: address,
                signDoc: signDoc
            }
            setMsgToSign(JSON.stringify(signDoc));

            console.log(session)
            console.log(params)

            const resp = await signClient.request({
                topic: session.topic,
                chainId: CAIP_BLOCKCHAIN_ID,
                request: {
                    method: "cosmos_signAmino",
                    params: params
                },
            });
            setSignature(resp.signature.signature);
        }
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
                            Signature: <p>{signature}</p>
                        </div>
                        <div>
                            Msg to Sign: <p>{msgToSign}</p>
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
