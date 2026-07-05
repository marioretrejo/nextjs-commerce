"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { type DialogMode } from "./constants";
import { useAddNumberDialog } from "./useAddNumberDialog";
import { ChooseMode } from "./ChooseMode";
import { TwilioBuyMode } from "./TwilioBuyMode";
import { SipAddMode } from "./SipAddMode";
import { ConnectSipMode } from "./ConnectSipMode";
import { ConnectTwilioMode } from "./ConnectTwilioMode";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode: DialogMode;
  initialTrunk: string | null;
  twilioConnected: boolean;
  twilioAccountSid: string | null;
  activeSipProvider: string | null;
  activeSipTrunkId: string | null;
  onNumbersChanged: () => void;
  onTwilioConnectionChange: (connected: boolean) => void;
  onSipTrunkChange: (name: string | null, id: string | null) => void;
  syncing: boolean;
  onSync: () => void;
}

export function AddNumberDialog(props: Props) {
  const {
    mode,
    setMode,
    sipPhone,
    setSipPhone,
    sipUri,
    setSipUri,
    sipName,
    setSipName,
    sipSaving,
    twilioSid,
    setTwilioSid,
    twilioToken,
    setTwilioToken,
    twilioConnecting,
    sipTrunkProvider,
    setSipTrunkProvider,
    sipTrunkHost,
    setSipTrunkHost,
    sipTrunkPort,
    setSipTrunkPort,
    sipTrunkUser,
    setSipTrunkUser,
    sipTrunkPass,
    setSipTrunkPass,
    sipTrunkNetmask,
    setSipTrunkNetmask,
    sipTrunkProtocol,
    setSipTrunkProtocol,
    sipTrunkShowPass,
    setSipTrunkShowPass,
    sipTrunkConnecting,
    selectedCountry,
    setSelectedCountry,
    numberType,
    setNumberType,
    availableNumbers,
    setAvailableNumbers,
    searchingNumbers,
    buyingPhone,
    connectTwilio,
    disconnectTwilio,
    searchTwilioNumbers,
    buyTwilioNumber,
    connectSipTrunk,
    disconnectSipTrunk,
    saveSip,
  } = useAddNumberDialog(props);
  const {
    open,
    onOpenChange,
    twilioConnected,
    twilioAccountSid,
    activeSipProvider,
    activeSipTrunkId,
    syncing,
    onSync,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        {/* Choose */}
        {mode === "choose" && (
          <ChooseMode
            setAvailableNumbers={setAvailableNumbers}
            setMode={setMode}
            twilioConnected={twilioConnected}
            setSipTrunkProvider={setSipTrunkProvider}
            setSipTrunkHost={setSipTrunkHost}
            setSipTrunkPort={setSipTrunkPort}
            setSipTrunkUser={setSipTrunkUser}
            setSipTrunkPass={setSipTrunkPass}
            setSipTrunkNetmask={setSipTrunkNetmask}
            setSipTrunkProtocol={setSipTrunkProtocol}
            setSipTrunkShowPass={setSipTrunkShowPass}
            activeSipProvider={activeSipProvider}
          />
        )}
        {mode === "twilio" && (
          <TwilioBuyMode
            setAvailableNumbers={setAvailableNumbers}
            setMode={setMode}
            setTwilioSid={setTwilioSid}
            setTwilioToken={setTwilioToken}
            twilioConnected={twilioConnected}
            selectedCountry={selectedCountry}
            setSelectedCountry={setSelectedCountry}
            numberType={numberType}
            setNumberType={setNumberType}
            availableNumbers={availableNumbers}
            searchTwilioNumbers={searchTwilioNumbers}
            searchingNumbers={searchingNumbers}
            buyTwilioNumber={buyTwilioNumber}
            buyingPhone={buyingPhone}
          />
        )}
        {mode === "sip" && (
          <SipAddMode
            setMode={setMode}
            sipPhone={sipPhone}
            setSipPhone={setSipPhone}
            sipUri={sipUri}
            setSipUri={setSipUri}
            sipName={sipName}
            setSipName={setSipName}
            sipSaving={sipSaving}
            saveSip={saveSip}
          />
        )}
        {mode === "connect-sip" && (
          <ConnectSipMode
            onOpenChange={onOpenChange}
            sipTrunkProvider={sipTrunkProvider}
            setSipTrunkProvider={setSipTrunkProvider}
            sipTrunkHost={sipTrunkHost}
            setSipTrunkHost={setSipTrunkHost}
            sipTrunkPort={sipTrunkPort}
            setSipTrunkPort={setSipTrunkPort}
            sipTrunkUser={sipTrunkUser}
            setSipTrunkUser={setSipTrunkUser}
            sipTrunkPass={sipTrunkPass}
            setSipTrunkPass={setSipTrunkPass}
            sipTrunkNetmask={sipTrunkNetmask}
            setSipTrunkNetmask={setSipTrunkNetmask}
            sipTrunkProtocol={sipTrunkProtocol}
            setSipTrunkProtocol={setSipTrunkProtocol}
            sipTrunkShowPass={sipTrunkShowPass}
            setSipTrunkShowPass={setSipTrunkShowPass}
            sipTrunkConnecting={sipTrunkConnecting}
            connectSipTrunk={connectSipTrunk}
            disconnectSipTrunk={disconnectSipTrunk}
            activeSipProvider={activeSipProvider}
            activeSipTrunkId={activeSipTrunkId}
          />
        )}
        {mode === "connect-twilio" && (
          <ConnectTwilioMode
            onOpenChange={onOpenChange}
            twilioSid={twilioSid}
            setTwilioSid={setTwilioSid}
            twilioToken={twilioToken}
            setTwilioToken={setTwilioToken}
            twilioConnecting={twilioConnecting}
            connectTwilio={connectTwilio}
            disconnectTwilio={disconnectTwilio}
            twilioConnected={twilioConnected}
            twilioAccountSid={twilioAccountSid}
            syncing={syncing}
            onSync={onSync}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
