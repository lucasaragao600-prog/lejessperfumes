ALTER PUBLICATION supabase_realtime ADD TABLE public.balanco_itens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.balanco_leituras;
ALTER PUBLICATION supabase_realtime ADD TABLE public.balancos;
ALTER TABLE public.balanco_itens REPLICA IDENTITY FULL;
ALTER TABLE public.balanco_leituras REPLICA IDENTITY FULL;
ALTER TABLE public.balancos REPLICA IDENTITY FULL;