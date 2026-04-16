import { Request, Response, NextFunction } from 'express';
import { OrdersService } from './orders.service';
import { PlaceOrderInput } from './orders.types';

export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  placeOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const input: PlaceOrderInput = {
        bondId:    String(req.body['bondId'] ?? ''),
        side:      req.body['side']      as PlaceOrderInput['side'],
        orderType: req.body['orderType'] as PlaceOrderInput['orderType'],
        quantity:  parseFloat(String(req.body['quantity'] ?? 0)),
        price:     req.body['price'] != null ? parseFloat(String(req.body['price'])) : undefined,
      };
      const order = await this.svc.placeOrder(userId, input);
      res.status(201).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  };

  getMyOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const status = req.query['status'] as string | undefined;
      const limit  = Math.min(100, parseInt(String(req.query['limit']  ?? 50), 10) || 50);
      const offset = Math.max(0,   parseInt(String(req.query['offset'] ?? 0),  10) || 0);

      const orders = await this.svc.getMyOrders(userId, status, limit, offset);
      res.json({ success: true, data: orders });
    } catch (err) {
      next(err);
    }
  };

  cancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId  = req.user!.id;
      const orderId = req.params['id']!;
      const order   = await this.svc.cancelOrder(orderId, userId);
      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  };

  getOrderBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bondId = req.params['bondId']!;
      const depth  = Math.min(50, parseInt(String(req.query['depth'] ?? 20), 10) || 20);
      const book   = await this.svc.getOrderBook(bondId, depth);
      res.json({ success: true, data: book });
    } catch (err) {
      next(err);
    }
  };
}
