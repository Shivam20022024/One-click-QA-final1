import { Worker, Queue } from 'bullmq';
export declare const executionQueueName = "test-executions";
export declare const executionQueue: Queue<any, any, string, any, any, string>;
export declare const initExecutionWorker: (io: any) => Worker<any, any, string>;
//# sourceMappingURL=executionWorker_copy.d.ts.map