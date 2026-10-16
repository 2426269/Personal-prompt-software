import type {
  NAIConnectionInput,
  NAIConnectionResult,
  NAISubmitInput,
  NAISubmitResult,
} from '@shared/types/nai'

import { NAIClient } from './nai-client'

export class NAIService {
  constructor(private readonly client: NAIClient = new NAIClient()) {}

  testConnection(input: NAIConnectionInput): Promise<NAIConnectionResult> {
    return this.client.testConnection(input)
  }

  submit(input: NAISubmitInput): Promise<NAISubmitResult> {
    return this.client.submit(input)
  }
}
