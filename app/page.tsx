"use client";

import useDebounce from "@/app/hooks/Debounce";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import clsx from "clsx";
import { ArrowDownUp, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [fromToken, setFromToken] = useState<string>("sol");
  const [toToken, setToToken] = useState<string>("usdc");
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [slippage, setSlippage] = useState<number>(0.5);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const debouncedValue = useDebounce(fromAmount, 500);

  const tokens = [
    { value: "sol", label: "SOL", decimals: "9" },
    { value: "usdc", label: "USDC", decimals: "6" },
    { value: "usdt", label: "USDT", decimals: "6" },
    { value: "ppusd", label: "PayPal USD", decimals: "6" },
  ];

  const getMintAddress = (token: string) => {
    switch (token) {
      case "sol":
        return "So11111111111111111111111111111111111111112"; // SOL mint address
      case "usdc":
        return "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC mint address
      case "usdt":
        return "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"; // Tether mint address
      case "ppusd":
        return "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo";
      default:
        return "";
    }
  };

  const handleFromTokenChange = (value: string) => {
    setFromToken(value);
    if (value === toToken) {
      setToToken(tokens.find((token) => token.value !== value)?.value || "");
    }
    estimateToAmount(fromAmount, value, toToken);
  };

  const handleToTokenChange = (value: string) => {
    setToToken(value);
    if (value === fromToken) {
      setFromToken(tokens.find((token) => token.value !== value)?.value || "");
    }
    estimateToAmount(fromAmount, fromToken, value);
  };

  const swapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const getJupiterQuote = async (
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number,
  ) => {
    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return response.json();
  };

  const formatTokenAmount = (amount: string, decimals: number) => {
    if (!amount) {
      return "0";
    }

    // Remove any existing decimal points and leading zeros
    const cleanAmount = amount.replace(/^0+/, "");
    if (!cleanAmount || cleanAmount === "0") {
      return "0";
    }

    // If the amount is shorter than the decimals, we need to pad with zeros
    if (cleanAmount.length <= decimals) {
      const padded = cleanAmount.padStart(decimals, "0");
      return `0.${padded}`;
    }

    // Split the amount into integer and decimal parts based on decimal places
    const integerPart = cleanAmount.slice(0, -decimals) || "0";
    const decimalPart = cleanAmount.slice(-decimals);

    // Format integer part with commas
    const formattedInteger = parseInt(integerPart).toLocaleString("en-US");

    // Trim any trailing zeros in decimal part
    const trimmedDecimalPart =
      decimalPart.length > decimals
        ? decimalPart.slice(0, decimals)
        : decimalPart;

    return `${formattedInteger}.${trimmedDecimalPart}`;
  };

  const estimateToAmount = async (amount: string, from: string, to: string) => {
    if (!amount || isNaN(Number(amount))) {
      setToAmount("");
      return;
    }

    setIsLoading(true);

    try {
      const fromTokenData = tokens.find((token) => token.value === from);
      const toTokenData = tokens.find((token) => token.value === to);

      if (!fromTokenData || !toTokenData) {
        throw new Error("Invalid token selection");
      }

      const fromDecimals = parseInt(fromTokenData.decimals!, 10);
      const toDecimals = parseInt(toTokenData.decimals!, 10);

      // Calculate amount in base units (considering decimals)
      const calculatedAmount = BigInt(
        Math.floor(Number(amount) * Math.pow(10, fromDecimals)),
      ).toString();

      // Use the utility function to get quote
      const data = await getJupiterQuote(
        getMintAddress(from),
        getMintAddress(to),
        Number(calculatedAmount),
        slippage * 100,
      );

      // Format the output amount using the formatting function with correct decimals
      const formattedOutput = formatTokenAmount(data.outAmount, toDecimals);

      setToAmount(formattedOutput);
    } catch (e) {
      console.error("Error fetching exchange rate:", e);
      setToAmount("");
    }

    setIsLoading(false);
  };

  const handleSwap = async () => {
    if (!wallet.connected || !fromAmount || !toAmount) {
      toast.error("Please connect your wallet and enter swap amounts");
      return;
    }

    setIsSwapping(true);

    try {
      const fromTokenData = tokens.find((token) => token.value === fromToken);
      const fromDecimals = parseInt(fromTokenData?.decimals || "0", 10);

      // Calculate amount in base units (considering decimals)
      const inputAmount = BigInt(
        Math.floor(Number(fromAmount) * Math.pow(10, fromDecimals)),
      ).toString();

      // 1. Get the route for the swap
      const quoteResponse = await getJupiterQuote(
        getMintAddress(fromToken),
        getMintAddress(toToken),
        Number(inputAmount),
        slippage * 100,
      );

      // 2. Get the swap transaction
      const swapRequestBody = {
        quoteResponse,
        userPublicKey: wallet.publicKey?.toString(),
        wrapUnwrapSOL: true,
      };

      const swapResponse = await fetch("https://quote-api.jup.ag/v6/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(swapRequestBody),
      });

      const swapData = await swapResponse.json();

      // 3. Deserialize the transaction
      const swapTransactionBuf = Buffer.from(
        swapData.swapTransaction,
        "base64",
      );
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // 4. Sign and execute the transaction
      try {
        if (!wallet.signTransaction) {
          throw new Error("Wallet does not support transaction signing!");
        }

        const signedTransaction = await wallet.signTransaction(transaction);
        const latestBlockHash = await connection.getLatestBlockhash();
        const rawTransaction = signedTransaction.serialize();
        const txid = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          maxRetries: 2,
        });

        const confirmation = await connection.confirmTransaction({
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: txid,
        });

        if (confirmation.value.err) {
          throw new Error("Transaction failed!");
        }

        // Success! Show the transaction hash
        toast.success(`Swap successful! Transaction ID: ${txid}`, {
          description: "Your tokens have been swapped successfully.",
          action: {
            label: "View Transaction",
            onClick: () =>
              window.open(`https://solscan.io/tx/${txid}`, "_blank"),
          },
        });

        setFromAmount("");
        setToAmount("");
      } catch (err) {
        console.error("Error signing transaction:", err);
        toast.error("Failed to sign transaction", {
          description:
            err instanceof Error
              ? err.message
              : "Unknown error occurred while signing",
        });
      }
    } catch (err) {
      console.error("Swap error:", err);
      toast.error("Swap failed", {
        description:
          err instanceof Error
            ? err.message
            : "Unknown error occurred during swap",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const handleSlippageChange = (value: number[]) => {
    setSlippage(value[0]);
  };

  useEffect(() => {
    estimateToAmount(fromAmount, fromToken, toToken);
  }, [debouncedValue, fromToken, toToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#30305a] relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-blob animation-delay-4000"></div>
      </div>

      <Card className="w-full max-w-md shadow-lg border-0 bg-[#1C1C28] bg-opacity-60 backdrop-blur-md">
        <CardHeader className="flex flex-col space-y-4 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Token Flow
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="text-purple-400 hover:text-purple-300"
            ></Button>
          </div>
          <div
            className={clsx(
              "w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors",
              {
                "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600":
                  !wallet.connected,
                "bg-green-500 hover:bg-green-600 text-white": wallet.connected,
              },
            )}
          >
            {!wallet.connected && <Wallet className="h-5 w-5" />}
            <WalletMultiButton
              style={{
                backgroundColor: "transparent",
                height: "2.25rem",
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 p-4 bg-[#2C2C3A] rounded-lg border border-purple-500/30">
            <Label htmlFor="from-token" className="text-purple-300">
              From
            </Label>
            <div className="flex space-x-2">
              <Select value={fromToken} onValueChange={handleFromTokenChange}>
                <SelectTrigger
                  id="from-token"
                  className="w-1/3 text-white bg-[#1C1C28] border-purple-500/50"
                >
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent className="text-white bg-[#1C1C28] border-purple-500/50">
                  {tokens.map((token) => (
                    <SelectItem
                      key={token.value}
                      value={token.value}
                      disabled={token.value === toToken}
                    >
                      {token.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text"
                placeholder="0.00"
                value={fromAmount}
                // onChange={(e) => setFromAmount(e.target.value)}
                className="w-2/3 bg-[#1C1C28] border-purple-500/50 text-white text-right pr-2"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/[^0-9.]/g, "");
                  setFromAmount(numericValue);
                }}
              />
            </div>
          </div>
          <div className="flex justify-center -my-2 relative z-10">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-[#1C1C28] text-purple-400 hover:text-purple-300 hover:bg-[#2C2C3A] border border-purple-500/30"
              onClick={swapTokens}
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2 p-4 bg-[#2C2C3A] rounded-lg border border-purple-500/30">
            <Label htmlFor="to-token" className="text-purple-300">
              To
            </Label>
            <div className="flex space-x-2">
              <Select value={toToken} onValueChange={handleToTokenChange}>
                <SelectTrigger
                  id="to-token"
                  className="w-1/3 text-white bg-[#1C1C28] border-purple-500/50"
                >
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent className="text-white bg-[#1C1C28] border-purple-500/50">
                  {tokens.map((token) => (
                    <SelectItem
                      key={token.value}
                      value={token.value}
                      disabled={token.value === fromToken}
                    >
                      {token.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-2/3">
                <Input
                  type="text"
                  placeholder="0.00"
                  value={isLoading ? "" : toAmount}
                  readOnly
                  className="w-full bg-[#1C1C28] border-purple-500/50 text-white text-right pr-2"
                />
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1 h-4 bg-purple-400 rounded-full animate-pulse"></div>
                    <div className="w-1 h-4 bg-purple-400 rounded-full animate-pulse mx-1"></div>
                    <div className="w-1 h-4 bg-purple-400 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2 p-4 bg-[#2C2C3A]/80 rounded-lg border border-purple-500/30 backdrop-blur-sm">
            <Label htmlFor="slippage" className="text-purple-300">
              Slippage Tolerance
            </Label>
            <div className="flex items-center space-x-2">
              <Slider
                id="slippage"
                min={0.1}
                max={5}
                step={0.1}
                value={[slippage]}
                onValueChange={handleSlippageChange}
                className="flex-grow"
              />
              <span className="text-white font-medium w-12 text-right">
                {slippage.toFixed(1)}%
              </span>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
            onClick={handleSwap}
            disabled={
              !wallet.connected ||
              isLoading ||
              !fromAmount ||
              !toAmount ||
              isSwapping
            }
          >
            {!wallet.connected ? (
              "Connect Wallet to Swap"
            ) : isSwapping ? (
              <div className="flex items-center justify-center space-x-2">
                <span>Swapping</span>
                <span className="flex space-x-1">
                  <span
                    className="w-2 h-2 bg-white rounded-full animate-bounce"
                    style={{ animationDelay: "0s" }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-white rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-white rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></span>
                </span>
              </div>
            ) : isLoading ? (
              "Estimating..."
            ) : (
              "Swap"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
