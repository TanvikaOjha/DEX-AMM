'use client';

 import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ADDRESSES, PAIR_ABI, TOKEN_ABI, RPC_URL } from "../lib/contracts";