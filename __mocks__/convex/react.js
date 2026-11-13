const useQuery = jest.fn(() => undefined);
const useMutation = jest.fn(() => jest.fn());
const useConvexAuth = jest.fn(() => ({ isAuthenticated: true, isLoading: false }));
const ConvexProvider = ({ children }) => children;
const ConvexReactClient = jest.fn();

module.exports = { useQuery, useMutation, useConvexAuth, ConvexProvider, ConvexReactClient };
